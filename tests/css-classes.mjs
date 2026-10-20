/* Static check: every literal `class="…"` in a view resolves to a real CSS rule.
   A typo like `stack-1` (no such utility) silently degrades the layout, and the
   app still "works", so nothing else catches it. */
import fs from 'node:fs';
import path from 'node:path';

const cssDir = 'assets/css';
const cssText = fs.readdirSync(cssDir)
  .filter((f) => f.endsWith('.css'))
  .map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8'))
  .join('\n');

const defined = new Set([...cssText.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));

// Defined by an inline <style> block at render time, or fully inline-styled so the
// class is decorative only. Pre-existing, not regressions from schema v2.
const ALLOWED = new Set(['grid-2col', 't-subtle', 'alert']);

const jsFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.js')) jsFiles.push(p);
  }
})('assets');

const missing = new Map();
for (const f of jsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  // Only literal class attributes — skip anything with a ${} interpolation.
  for (const m of src.matchAll(/class="([^"$]+)"/g)) {
    for (const raw of m[1].split(/\s+/)) {
      const c = raw.trim();
      if (!c || c.includes('{')) continue;
      if (defined.has(c) || ALLOWED.has(c)) continue;
      if (!missing.has(c)) missing.set(c, new Set());
      missing.get(c).add(f);
    }
  }
}

if (missing.size) {
  console.log('CLASSES USED IN JS BUT NOT DEFINED IN CSS:');
  for (const [c, files] of [...missing].sort()) {
    console.log(`  .${c}  <- ${[...files].join(', ')}`);
  }
  console.log(`\n${missing.size} problem(s).`);
  process.exit(1);
} else {
  console.log(`OK — every literal class= in JS resolves (${jsFiles.length} modules, ${defined.size} rules).`);
}