/* Static check: helper calls used in a module but never declared/imported there.
   Catches the `$`/`$$` class of runtime ReferenceError that only shows up in the
   browser (e.g. a view calling $$() without importing it). */
import fs from 'node:fs';
import path from 'node:path';

const AMBIENT = new Set([
  'if','for','while','switch','catch','return','typeof','new','await','function','import','export',
  'console','Math','JSON','Date','Number','String','Boolean','Array','Object','Set','Map','Promise',
  'RegExp','Error','NaN','Infinity','undefined','null','true','false','parseInt','parseFloat','isNaN',
  'Intl','Symbol','globalThis','document','window','location','localStorage','setTimeout','clearTimeout',
  'URL','URLSearchParams','Blob','URLSearchParams',
]);

const HELPERS = [
  '$', '$$', 'el', 'escapeHtml', 'uid', 'todayISO', 'toISODate', 'fromISODate', 'fmtDate',
  'fmtDateTime', 'fmtTime', 'fmtCLP', 'fmtPct', 'relativeTime', 'debounce', 'initials',
  'downloadBlob', 'addDays', 'refreshIcons', 'openModal', 'toast', 'toastError', 'confirmDialog',
];

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})('assets');

const problems = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const declared = new Set();

  for (const m of src.matchAll(/import\s+([^;]*?)\s+from\s+['"][^'"]+['"]/g)) {
    const braces = m[1].match(/\{([^}]*)\}/);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (name) declared.add(name);
      }
    }
    for (const part of m[1].replace(/\{[^}]*\}/, '').split(',')) {
      const name = part.trim();
      if (name && name !== '*') declared.add(name);
    }
  }
  for (const m of src.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const p of m[1].split(',')) declared.add(p.trim().split(/\s*[:=]/)[0].trim());
  }
  for (const m of src.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of src.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  // Arrow / function parameter lists, including destructured params.
  for (const m of src.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) {
    for (const raw of m[1].split(',')) {
      const p = raw.trim();
      if (!p) continue;
      const brace = p.match(/^\{([^}]*)\}/);
      if (brace) {
        for (const sub of brace[1].split(',')) declared.add(sub.trim().split(/\s*[:=]/)[0].trim());
      } else {
        const n = p.replace(/[.\[\]?=]/g, ' ').trim().split(/\s+/)[0];
        if (/^[A-Za-z_$][\w$]*$/.test(n)) declared.add(n);
      }
    }
  }
  for (const m of src.matchAll(/^\s{2,}([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)) declared.add(m[1]);
  // Function declarations written as `function name (`.
  for (const m of src.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) declared.add(m[1]);

  // Strip comments so commented-out code can't produce false positives.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');

  for (const name of HELPERS) {
    if (declared.has(name) || AMBIENT.has(name)) continue;
    // Match `name(` only when NOT preceded by a dot (method call) or a quote (string).
    const re = new RegExp('(?<![\\w$.\'"`])' + name.replace(/\$/g, '\\$') + '\\s*\\(', 'g');
    if (re.test(code)) problems.push(`  ${name}() used but not declared/imported  <- ${f}`);
  }
}

if (problems.length) {
  console.log('UNDECLARED HELPER CALLS:');
  for (const p of problems) console.log(p);
  console.log(`\n${problems.length} problem(s).`);
  process.exit(1);
} else {
  console.log(`OK — no undeclared helper calls across ${files.length} modules.`);
}