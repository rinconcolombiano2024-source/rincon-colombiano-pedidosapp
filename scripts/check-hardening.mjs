#!/usr/bin/env node
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
const ignored=new Set(['node_modules','.git','test-results','playwright-report']);
function* files(dir){for(const n of readdirSync(dir)){if(ignored.has(n))continue;const p=join(dir,n);if(statSync(p).isDirectory())yield* files(p);else yield p;}}
const paths=[...files('.')];let syntax=0;
for(const p of paths.filter(p=>/\.(?:mjs|cjs|js|ts)$/.test(p))){
 if(p.endsWith('.ts')){
  const source=stripTypeScriptTypes(readFileSync(p,'utf8'),{mode:'strip',sourceUrl:p});
  execFileSync(process.execPath,['--input-type=module','--check'],{input:source,stdio:'pipe'});
 }else execFileSync(process.execPath,['--check',p],{stdio:'pipe'});
 syntax++;
}
for(const p of paths.filter(p=>p.startsWith('www/')&&!p.endsWith('BUILD-METADATA.json'))){
 const name=p.slice(4);if(!readFileSync(p).equals(readFileSync(name)))throw new Error('SOURCE_WWW_MISMATCH: '+name);
}
const config=JSON.parse(readFileSync('vercel.json','utf8'));
const headers=config.headers.flatMap(h=>h.headers);const csp=headers.find(h=>h.key==='Content-Security-Policy')?.value;
if(!csp||csp.includes('unsafe-eval')||/script-src[^;]*'unsafe-inline'/.test(csp)||!csp.includes("object-src 'none'"))throw new Error('CSP_POLICY_FAILED');
// Syntax policy on app-owned JS, not Node test harnesses or UMD globalThis compatibility fallback.
for(const p of paths.filter(p=>/\.(?:js|html)$/.test(p)&&!['vendor/','www/','tests/','scripts/'].some(d=>p.startsWith(d)))){
 if(/\beval\s*\(|\bnew\s+Function\s*\(/.test(readFileSync(p,'utf8')))throw new Error('DYNAMIC_BROWSER_EVALUATION: '+p);
}
const plan=JSON.parse(readFileSync('V5-MIGRATIONS.json','utf8')).plan;
const ids=new Set();for(const m of plan){const id=m.file.match(/^MIGRACION-(V5-\d{8}-\d{2})-/)?.[1];if(!id||ids.has(id))throw new Error('DUPLICATE_MIGRATION_ID');ids.add(id);readFileSync(m.file);for(const d of m.requires)if(d.endsWith('.sql'))readFileSync(d);}
// The lockfile is reviewed, not just runtime package.json.
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
if(lock.packages['node_modules/uuid']?.version!=='11.1.1')throw new Error('UUID_PATCH_MISSING');
if(lock.packages['node_modules/brace-expansion']?.version!=='5.0.12')throw new Error('BRACE_PATCH_MISSING');
console.log(JSON.stringify({syntaxFiles:syntax,distributedFiles:paths.filter(p=>p.startsWith('www/')).length-1,migrations:ids.size,csp:'enforced without unsafe-eval',firstPartyDynamicEvaluation:false}));
