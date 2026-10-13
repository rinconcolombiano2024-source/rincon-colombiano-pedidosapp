import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const source=readFileSync('scripts/verify-deployment.mjs','utf8').replace(/^#![^\n]*\n/, '');
function run(overrides={}) {
 const bootstrap=`
 const overrides=${JSON.stringify(overrides)};
 globalThis.fetch=async(url,options={})=>{
  const path=new URL(url).pathname,origin=options.headers?.origin;
  const headers={'strict-transport-security':'max-age=31536000','x-content-type-options':'nosniff','content-security-policy':"script-src 'self'"};
  if(options.method==='OPTIONS'){
    if(origin==='https://evil.example')return new Response(null,{status:403});
    return new Response(null,{status:204,headers:{'access-control-allow-origin':origin}});
  }
  if(options.method==='POST')return new Response(null,{status:overrides[path.split('/').pop()]??401});
  return new Response(null,{status:path.endsWith('.html')?200:404,headers});
 };
 `;
 return spawnSync(process.execPath,['--input-type=module','--eval',bootstrap+source],{
  env:{...process.env,SITE_URL:'https://restaurant.example',FUNCTIONS_URL:'https://project.example/functions/v1'},encoding:'utf8'});
}
test('deployment verifier accepts configured endpoints rejecting unsigned requests',()=>{
 const r=run();assert.equal(r.status,0,r.stderr+r.stdout);assert.match(r.stdout,/35\/35 comprobaciones correctas/);
});
for(const endpoint of ['fiscal-agent-gateway','external-delivery-webhook','marketplace-webhook']) {
 for(const status of [404,503,200])test(`${endpoint}: HTTP ${status} cannot certify deployment readiness`,()=>{
  const r=run({[endpoint]:status});assert.equal(r.status,1,r.stderr+r.stdout);
  assert.match(r.stdout,new RegExp('FALLO  '+endpoint));
 });
}
