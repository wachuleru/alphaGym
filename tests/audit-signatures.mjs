// Detects calls to a function that don't match its declared arity.
// Catches bugs like `drawProgressChart(metricKey)` when the function expects `(student, metricKey)`.
import fs from 'node:fs/promises';
import path from 'node:path';

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// Find function declarations: function NAME(args) { ... }
function parseFunctionDecls(src) {
  const decls = new Map();
  const re = /\bfunction\s+(\w+)\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let depth = 1, i = m.index + m[0].length, start = i;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === '"' || c === "'" || c === '`') {
        const q = c; i++;
        while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      }
      i++;
    }
    const paramsRaw = src.substring(start, i - 1);
    const params = splitTopLevel(paramsRaw, ',').map((s) => s.trim()).filter(Boolean);
    decls.set(m[1], { params, required: requiredParamCount(params), line: src.substring(0, m.index).split('\n').length });
  }
  return decls;
}

function splitTopLevel(s, sep) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; }
    }
    else if (c === sep && depth === 0) { out.push(s.substring(start, i)); start = i + 1; }
  }
  out.push(s.substring(start));
  return out;
}

// Count params that are required (no default value)
function requiredParamCount(params) {
  let n = 0;
  for (const p of params) {
    // strip destructuring / rest
    const core = p.replace(/^\.\.\./, '').trim();
    if (!core.includes('=')) n++;
  }
  return n;
}

// Find call sites of a function name. Skips declarations, comments, and member access.
function parseCallSites(src, name) {
  // Strip comments
  let clean = src.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
  clean = clean.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  // Strip string contents
  clean = clean.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, (m) => "'" + ' '.repeat(m.length - 2) + "'");

  const sites = [];
  // Skip the declaration line
  const declRe = new RegExp(`function\\s+${name}\\s*\\(`, 'g');
  let m;
  while ((m = declRe.exec(clean)) !== null) {
    clean = clean.replace(m[0], ' '.repeat(m[0].length));
  }
  // Match NAME(...) preceded by start-of-line or non-identifier non-dot
  // (i.e., not a member access like Math.round)
  const callRe = new RegExp(`(^|[^.\\w])${name}\\s*\\(`, 'g');
  while ((m = callRe.exec(clean)) !== null) {
    const realStart = m.index + m[1].length;
    const line = clean.substring(0, realStart).split('\n').length;
    // Extract the args between this ( and matching )
    let depth = 1, i = realStart + m[0].length - m[1].length, start = i;
    while (i < clean.length && depth > 0) {
      const c = clean[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === '"' || c === "'" || c === '`') {
        const quote = c;
        i++;
        while (i < clean.length && clean[i] !== quote) {
          if (clean[i] === '\\') i++;
          i++;
        }
      }
      i++;
    }
    sites.push({ line, argsRaw: clean.substring(start, i - 1) });
  }
  return sites;
}

function countArgs(argsRaw) {
  // Skip arrow function bodies, template expressions, and respect commas in [], {}, ()
  let depth = 0, count = 1, hasAny = argsRaw.trim() !== '';
  if (!hasAny) return 0;
  for (let i = 0; i < argsRaw.length; i++) {
    const c = argsRaw[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) count++;
  }
  return count;
}

const files = await walk('assets/js');
const problems = [];

for (const f of files) {
  const src = await fs.readFile(f, 'utf8');
  const decls = parseFunctionDecls(src);
  for (const [name, info] of decls) {
    const sites = parseCallSites(src, name);
    for (const s of sites) {
      const n = countArgs(s.argsRaw);
      if (n < info.required) {
        problems.push(`${f.replace(/\\/g, '/')}:${s.line} ${name}(${s.argsRaw.trim()}) → ${n} args, function requires ≥${info.required} [${info.params.join(', ')}]`);
      }
    }
  }
}

if (!problems.length) {
  console.log('OK — all call sites match function arity.');
} else {
  console.log(`${problems.length} arity mismatch(es):`);
  for (const p of problems) console.log('  - ' + p);
}
