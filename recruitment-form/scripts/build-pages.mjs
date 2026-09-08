import { mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');
rmSync(out, { recursive:true, force:true });
mkdirSync(out, { recursive:true });
for (const file of ['index.html','admin.html','logo-netcar.png']) copyFileSync(resolve(root,file),resolve(out,file));
// O deploy Pages compila functions/ do projeto. O artefato de validação não
// integra os arquivos públicos nem pode ser confundido com um Worker multipart.
const workerCheck = resolve(root,'output/worker-check');
rmSync(workerCheck, { recursive:true, force:true });
execFileSync(resolve(root,'node_modules/.bin/wrangler'), ['pages','functions','build','functions','--outdir',workerCheck], { cwd:root,stdio:'inherit' });
writeFileSync(resolve(out,'_routes.json'),JSON.stringify({version:1,include:['/api/*'],exclude:[]},null,2));
writeFileSync(resolve(out,'_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/admin.html\n  Cache-Control: no-store\n');
console.log('Pacote de publicação preparado somente com formulário, painel, logo e API.');
