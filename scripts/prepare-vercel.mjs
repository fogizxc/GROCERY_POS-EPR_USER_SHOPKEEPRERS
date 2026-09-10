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

const appPath = path.resolve('src/App.tsx');
if (fs.existsSync(appPath)) {
  const original = fs.readFileSync(appPath, 'utf8');
  const oldBootstrap = "useEffect(()=>{let alive=true;(async()=>{try{await api.me();const [p,s,o]=await Promise.all([api.products(),api.shops(),role==='customer'?api.customerOrders():api.orders()]);if(alive){setProducts(p);setShops(s);setOrders(o)}}catch(error){if(localStorage.getItem('freshcart_token')){localStorage.removeItem('freshcart_token');localStorage.removeItem('freshcart_role');window.location.reload();}else if(alive)flash(error instanceof Error?error.message:'Unable to connect to FreshCart API')}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[role]);";
  const newBootstrap = "useEffect(()=>{let alive=true;(async()=>{try{await api.me();const [p,s,o]=await Promise.all([api.products().catch(()=>[]),api.shops().catch(()=>[]),role==='customer'?api.customerOrders().catch(()=>[]):api.orders().catch(()=>[])]);if(alive){setProducts(p);setShops(s);setOrders(o)}}catch(error){const message=error instanceof Error?error.message:'Unable to connect to FreshCart API';const authFailure=/Authentication required|Invalid credentials|token|401/i.test(message);if(authFailure){localStorage.removeItem('freshcart_token');localStorage.removeItem('freshcart_role');window.location.reload();}else if(alive){console.error('FreshCart bootstrap failed:',error);flash('You are signed in, but some FreshCart data is temporarily unavailable.')}}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[role]);";
  if (original.includes(oldBootstrap) && !original.includes("console.error('FreshCart bootstrap failed:',error)")) {
    fs.writeFileSync(appPath, original.replace(oldBootstrap, newBootstrap));
    console.log('FreshCart Vercel preparation: protected authenticated sessions from non-auth bootstrap failures.');
  }
}

console.log(`FreshCart Vercel preparation: normalized runtime imports and request headers in ${changedFiles} server file(s).`);
