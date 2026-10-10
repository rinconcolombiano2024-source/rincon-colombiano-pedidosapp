import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DeliveryOutbox} from '../../delivery-bridge/src/outbox.mjs';
const require=createRequire(import.meta.url);
const {integrationGate,authenticateActor,apiRequest}=require('../integration/support/supabase-rest.cjs');
const {probeForeignMutation}=require('../integration/support/mutation-probe.cjs');
const registry={create:()=>({})};
const envKeys=['RC_TEST_SUPABASE_URL','RC_TEST_SUPABASE_ANON_KEY','RC_TEST_CONFIRM_TEST_PROJECT','RC_TEST_RESTAURANT_A_TOKEN'];
async function withEnvironment(values,fn){const old=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));try{for(const k of envKeys){if(values[k]===undefined)delete process.env[k];else process.env[k]=values[k];}return await fn();}finally{for(const k of envKeys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}}
test('queue rejects NaN, Infinity, zero attempts and invalid retry/deadline budgets before any work',()=>{
 for(const options of [{maxAttempts:Infinity},{maxAttempts:0},{maxAttempts:101},{timeoutMs:NaN},{leaseMs:Infinity},{baseDelayMs:-1},{maxDelayMs:1},{breakerThreshold:0},{maxTickMs:Infinity},{deadlineMs:{accept:0}},{deadlineMs:{invented:100}}]){
  assert.throws(()=>new DeliveryOutbox({registry,simulationOnly:true,fetchImpl:async()=>({ok:true}),...options}),/INVALID_/);
 }
 assert.doesNotThrow(()=>new DeliveryOutbox({registry,simulationOnly:true,fetchImpl:async()=>({ok:true})}));
});
test('staging gate rejects canonical aliases of production and remote HTTP/credentials/path URLs',async()=>{
 for(const url of ['https://OUULREHCGMFBETTSEIBN.supabase.co:443/','https://ouulrehcgmfbettseibn.supabase.co./','http://test.invalid','https://user:pass@test.invalid','https://test.invalid/rest/v1/']){
  await withEnvironment({RC_TEST_SUPABASE_URL:url,RC_TEST_SUPABASE_ANON_KEY:'fixture',RC_TEST_CONFIRM_TEST_PROJECT:'YES'},()=>assert.equal(integrationGate().ready,false,url));
 }
 await withEnvironment({RC_TEST_SUPABASE_URL:'https://test.invalid/',RC_TEST_SUPABASE_ANON_KEY:'fixture',RC_TEST_CONFIRM_TEST_PROJECT:'YES'},()=>assert.equal(integrationGate().ready,true));
});
const token='eyJfixture.'+Buffer.from(JSON.stringify({sub:'fixture-user'})).toString('base64url')+'.fixture-signature';
test('provided JWT must be verified by auth server; guessed subject or invalid token cannot pass isolation',async()=>{
 const old=globalThis.fetch;let calls=0;
 try{await withEnvironment({RC_TEST_RESTAURANT_A_TOKEN:token},async()=>{
  for(const [status,data] of [[401,{}],[200,{id:'another-user',role:'authenticated'}],[200,{id:'fixture-user',role:'service_role'}]]){
   globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify(data),{status});};
   await assert.rejects(()=>authenticateActor('RESTAURANT_A',{url:'https://test.invalid',anonKey:'fixture'}),/no validado/);
  }
  globalThis.fetch=async()=>new Response(JSON.stringify({id:'fixture-user',role:'authenticated'}));
  assert.equal((await authenticateActor('RESTAURANT_A',{url:'https://test.invalid',anonKey:'fixture'})).userId,'fixture-user');
 });assert.equal(calls,3);}finally{globalThis.fetch=old;}
});
test('mutation uses representation and timeout; invalid paths reject without sending credentials',async()=>{
 const old=globalThis.fetch;let seen=[];
 try{globalThis.fetch=async(url,options)=>{seen.push({url,options});return new Response('[]');};
  await assert.rejects(()=>apiRequest({config:{url:'https://test.invalid',anonKey:'fixture'},path:'https://evil.invalid/rest/v1/orders'}),/INVALID_TEST_API_PATH/);assert.equal(seen.length,0);
  await apiRequest({config:{url:'https://test.invalid',anonKey:'fixture'},method:'PATCH',path:'/rest/v1/app_settings?user_id=eq.fixture',body:{updated_at:'fixture'}});
  assert.equal(seen[0].options.headers.Prefer,'return=representation');assert.ok(seen[0].options.signal instanceof AbortSignal);
 }finally{globalThis.fetch=old;}
});
function fixtureRequest({foreignStatus=200,mutate=false,missing=false}={}){
 let value='original',restores=0;
 const request=async({token,method='GET',body})=>{
  if(method==='GET')return {status:200,data:missing?[]:[{updated_at:value}]};
  if(token==='owner'){value=body.updated_at;restores++;return {status:200,data:[{updated_at:value}]};}
  if(mutate){value=body.updated_at;return {status:200,data:[{updated_at:value}]};}
  return {status:foreignStatus,data:[]};
 };
 return {request,read:()=>value,restores:()=>restores};
}
const args={config:{url:"https://test.invalid",productionUrl:"https://production.invalid",confirmed:true,mutationsAllowed:true},attacker:{userId:'A',token:'attacker'},owner:{userId:'B',token:'owner'},table:'app_settings',filters:{user_id:'B'},field:'updated_at',value:'changed'};
test('RLS mutation probe passes only authenticated denial or zero matching rows, with owner fixture unchanged',async()=>{
 for(const foreignStatus of [200,403]){const f=fixtureRequest({foreignStatus});await probeForeignMutation({...args,request:f.request});assert.equal(f.read(),'original');assert.equal(f.restores(),0);}
});
test('RLS mutation probe fails expired auth, schema error, nonexistent fixture and observed mutation',async()=>{
 for(const foreignStatus of [401,400,404,500]){const f=fixtureRequest({foreignStatus});await assert.rejects(()=>probeForeignMutation({...args,request:f.request}),/cannot prove RLS/);}
 const absent=fixtureRequest({missing:true});await assert.rejects(()=>probeForeignMutation({...args,request:absent.request}),/existing owner fixture/);
 const changed=fixtureRequest({mutate:true});await assert.rejects(()=>probeForeignMutation({...args,request:changed.request}),/returned rows/);assert.equal(changed.read(),'original');assert.equal(changed.restores(),1);
});

test('mutation probe independently fails closed without opt-in, unknown production or production aliases',async()=>{
 for(const config of [{...args.config,mutationsAllowed:false},{...args.config,confirmed:false},{...args.config,productionUrl:''},{...args.config,url:'https://PRODUCTION.invalid:443/'}]){
  let calls=0;await assert.rejects(()=>probeForeignMutation({...args,config,request:async()=>{calls++;throw new Error('must not send');}}));assert.equal(calls,0);
 }
});
