import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('server');
let changedFiles = 0;
let changedImports = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function resolveLocalSpecifier(file, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(file), specifier);
  if (path.extname(base)) return null;
  if (fs.existsSync(`${base}.ts`)) return `${specifier}.ts`;
  if (fs.existsSync(`${base}.tsx`)) return `${specifier}.tsx`;
  if (fs.existsSync(path.join(base, 'index.ts'))) return path.posix.join(specifier.replaceAll('\\', '/'), 'index.ts');
  return null;
}

for (const file of walk(root)) {
  const original = fs.readFileSync(file, 'utf8');
  let source = original;

  source = source.replace(/(\bfrom\s*|\bimport\s*\()(['"])(\.\.?\/[^'"\n]+)\2/g, (match, prefix, quote, specifier) => {
    const fixed = resolveLocalSpecifier(file, specifier);
    return fixed ? `${prefix}${quote}${fixed}${quote}` : match;
  });

  source = source.replace(/\breq\.header\(\s*['"]authorization['"]\s*\)/g, 'req.headers.authorization');
  source = source.replace(/\breq\.header\(\s*['"]Idempotency-Key['"]\s*\)/g, "req.headers['idempotency-key']");

  if (source !== original) {
    fs.writeFileSync(file, source);
    changedFiles += 1;
    changedImports += 1;
  }
}

console.log(`FreshCart Vercel preparation: normalized runtime imports and request headers in ${changedFiles} server file(s).`);
