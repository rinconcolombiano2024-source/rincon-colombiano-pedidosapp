import test from 'node:test';
import assert from 'node:assert/strict';
import {edgeHarness} from '../support/edge-harness.mjs';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-private-service',GOOGLE_TRANSLATE_API_KEY:'fixture-provider-key'};
function fixture({data=null,error=null,cached=null}={}){
 const calls=[];const h=edgeHarness('supabase/functions/translate-public-content/index.ts',{env,createClient:()=>({
  from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:cached,error:null})};return q;},
  rpc:async(name,params)=>{calls.push({name,params});return {data,error};}
 })});return {h,calls};
}
const req=()=>new Request('https://fixture.supabase.co/functions/v1/translate-public-content',{method:'POST',headers:{origin:'https://rincon-colombiano-pedidosapp.vercel.app','content-type':'application/json','cf-connecting-ip':'spoofed-client'},body:JSON.stringify({text:'Hola',targetLanguage:'pl',sourceLanguage:'es'})});
test('actual translation Edge: missing global quota fails closed, never falls back or contacts provider',async()=>{
 for(const error of [{code:'PGRST202',message:'missing function'},{message:'Could not find the function'},{message:'does not exist'}]){
  const f=fixture({error});assert.equal((await f.h(req())).status,503);assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'rc_ordera_consume_translation_quota_v2');
 }
});
test('actual translation Edge: client/global denial and database failure cannot call paid provider',async()=>{
 for(const [config,status] of [[{data:'global_limit'},429],[{data:'client_limit'},429],[{data:'unexpected'},429],[{error:{code:'DB_DOWN',message:'connection failed'}},500]]){
  const f=fixture(config);assert.equal((await f.h(req())).status,status);assert.equal(f.calls.length,1);assert.match(f.calls[0].params.p_client_hash,/^[0-9a-f]{64}$/);
 }
});
test('actual translation Edge: existing cached translation remains available without quota or network',async()=>{
 const f=fixture({cached:{translated_text:'Cześć'}});const r=await f.h(req());assert.equal(r.status,200);assert.deepEqual(await r.json(),{translatedText:'Cześć',cached:true});assert.equal(f.calls.length,0);
});

test('actual translation Edge: streamed and advertised oversized bodies fail before database work',async()=>{
 for(const length of [undefined,'1','99999']){
  const f=fixture();const r=await f.h(new Request('https://fixture/translate',{method:'POST',headers:{origin:'https://rincon-colombiano-pedidosapp.vercel.app',...(length?{'content-length':length}:{})},body:JSON.stringify({text:'x'.repeat(9000),targetLanguage:'pl'})}));
  assert.equal(r.status,413);assert.equal(f.calls.length,0);
 }
});
test('actual translation Edge: provider failure returns 502 without an automatic paid retry',async()=>{
 const f=fixture({data:'ok'});assert.equal((await f.h(req())).status,502);assert.equal(f.calls.length,1);
});

test('actual translation Edge: null, scalar and array JSON cannot crash or access the database',async()=>{
 for(const body of ['null','[]','123','"text"']){
  const f=fixture();assert.equal((await f.h(new Request('https://fixture/translate',{method:'POST',body}))).status,400);assert.equal(f.calls.length,0);
 }
});
