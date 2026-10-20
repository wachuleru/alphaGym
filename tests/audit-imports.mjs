// Verifies every static import resolves to a real export.
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = 'assets/js';

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// Parse an import statement and return its module path + imported names
function parseImports(src) {
  const re = /import\s+(?:\{([^}]+)\}\s+from\s+|([^\s]+)\s+|\*\s+as\s+(\w+)\s+from\s+)(['"])([^'"]+)\4/g;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[5]) {
      const names = m[1] ? m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)
                       : (m[2] ? ['*default'] : (m[3] ? [`*as ${m[3]}`] : []));
    // also strip leading & from "export { $ }"
    for (let k = 0; k < names.length; k++) names[k] = names[k].replace(/^\$/, '$').replace(/^\$/, '$');
      out.push({ module: m[5], names });
    }
  }
  return out;
}

// Extract exported names from a module by reading its source
function listExports(src) {
  const names = new Set();
  // export const X / export function X
  const named = src.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([\$\w]+)/g);
  for (const m of named) names.add(m[1]);
  // export { A, B as C }
  const grouped = src.matchAll(/export\s*\{([^}]+)\}/g);
  for (const g of grouped) {
    for (const item of g[1].split(',')) {
      const first = item.trim().split(/\s+as\s+/)[0].trim();
      if (first) names.add(first);
    }
  }
  // export default
  if (/export\s+default/.test(src)) names.add('default');
  return names;
}

const files = await walk(ROOT);
const modules = new Map();
for (const f of files) modules.set(f, await fs.readFile(f, 'utf8'));

// Resolve relative imports
function resolve(from, to) {
  if (to.startsWith('./') || to.startsWith('../')) {
    let dir = path.dirname(from);
    const parts = to.split('/');
    for (const p of parts) {
      if (p === '.') continue;
      if (p === '..') dir = path.dirname(dir);
      else dir = path.join(dir, p);
    }
    // Try .js extension
    if (!dir.endsWith('.js')) return dir + '.js';
    return dir;
  }
  return null; // external
}

const problems = [];
const seen = new Set();

for (const [file, src] of modules) {
  const imp = parseImports(src);
  for (const i of imp) {
    const resolved = resolve(file, i.module);
    if (!resolved) continue;
    if (!modules.has(resolved)) {
      problems.push({ file, missing: i.module, names: i.names });
      continue;
    }
    const targetSrc = modules.get(resolved);
    const exports = listExports(targetSrc);
    for (const n of i.names) {
      const root = n.split(/\s+as\s+/)[0].trim();
      if (n === '*default' || n.startsWith('*as ')) continue;
      if (!exports.has(root)) {
        problems.push({ file, module: i.module, name: root, resolved });
      }
    }
  }
}

if (!problems.length) {
  console.log('OK — all imports resolve to real exports.');
} else {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) {
    console.log(`  - ${p.file}: ${JSON.stringify(p)}`);
  }
}
