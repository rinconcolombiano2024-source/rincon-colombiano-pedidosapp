import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
function run(mode) {
 return spawnSync(process.execPath,['--input-type=module','-e',`
 import {readFileSync} from 'node:fs';
 globalThis.fetch=async url=>{
 const pathname=new URL(url).pathname;
 const path=pathname==='/'?'index.html':pathname.slice(1);
 let body=readFileSync(path);
 if(${JSON.stringify(mode)}==='home'&&pathname==='/')body=Buffer.from('old portal');
 if(${JSON.stringify(mode)}==='stale'&&path==='app.js')body=Buffer.from('old POS');
 if(${JSON.stringify(mode)}==='marker'&&path==='rc-ordera-release.json')body=Buffer.from('{}');
 return new Response(body,{status:200});
 };
 await import('./scripts/verify-production-release.mjs');
 `],{encoding:'utf8'});
}
test('production verifier accepts identical release and critical files',()=>{const r=run('same');assert.equal(r.status,0,r.stderr);});
test('production verifier rejects stale POS even when release marker matches',()=>{const r=run('stale');assert.equal(r.status,1);assert.match(r.stderr,/app.js/);});
test('production verifier rejects an outdated root portal with the correct marker',()=>{const r=run('home');assert.equal(r.status,1);assert.match(r.stderr,/ruta \\//);});
test('production verifier rejects mismatched marker',()=>{assert.equal(run('marker').status,1);});
