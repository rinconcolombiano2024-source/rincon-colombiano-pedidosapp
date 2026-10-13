import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {validateSumUpConfig,isTrustedSumUpHostedUrl} from '../../supabase/functions/_shared/sumup-hosted.ts';
const restaurant='9702bf42-2f50-46b2-8f8a-d5f80ba576d5';
const order='e6c2426f-b34d-4e5a-9149-e63327c86255';
const checkout='64553e20-3f0e-49e4-8af3-fd0eca86ce91';
function harness(route,overrides={},status='pending'){
 const env={SUPABASE_URL:'https://ouulrehcgmfbettseibn.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',SUMUP_API_KEY:'test-only',SUMUP_MERCHANT_CODE:'MCXXXXXX',RC_SUMUP_RESTAURANT_USER_ID:restaurant,APP_BASE_URL:'https://rincon-colombiano-pedidosapp.vercel.app',RC_SUMUP_PAYMENTS_ENABLED:'1',...overrides};
 const calls={clients:0,reads:0,provider:0,writes:0};let handler;
 const row={checkout_id:checkout,order_id:order,restaurant_user_id:restaurant,merchant_code:env.SUMUP_MERCHANT_CODE,attempt_number:1,amount_minor:1000,currency:'PLN',status};
 const admin={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{calls.reads++;return {data:row,error:null};}})})}),rpc:async()=>{calls.writes++;return {data:{status:'paid'},error:null};}};
 const context=vm.createContext({URL,Request,Response,TextDecoder,Uint8Array,console,
 Deno:{env:{get:name=>env[name]},serve:fn=>{handler=fn;}},
 withCors:fn=>fn,validateSumUpConfig,isTrustedSumUpHostedUrl,
 createClient:()=>{calls.clients++;return admin;},
 createSumUpHostedCheckout:()=>{throw Error('unexpected create');},
 parseSumUpWebhookEvent:raw=>raw.event_type==='CHECKOUT_STATUS_CHANGED'?{checkoutId:raw.id}:null,
 inspectSumUpWebhook:async()=>{calls.provider++;return {kind:'verified_only',checkoutId:checkout,providerStatus:'PAID'};},
 });
 const source=readFileSync(`supabase/functions/${route}/index.ts`,'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(stripTypeScriptTypes(source),context);
 return {calls,invoke:()=>handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({orderId:order,publicToken:'test-token',event_type:'CHECKOUT_STATUS_CHANGED',id:checkout})}))};
}
for(const route of ['sumup-checkout','sumup-webhook']){
 test(`${route}: invalid merchant, secret or origin cannot read or reserve orders`,async()=>{
  for(const overrides of [{SUMUP_MERCHANT_CODE:'bad!'},{SUMUP_API_KEY:' test-only'},{SUMUP_API_KEY:'test\nkey'},{APP_BASE_URL:'http://example.com'},{APP_BASE_URL:'https://example.com/path'},{APP_BASE_URL:'https://user:pass@example.com'},{RC_SUMUP_PAYMENTS_ENABLED:'0'}]){
   const h=harness(route,overrides);assert.equal((await h.invoke()).status,503);assert.deepEqual(h.calls,{clients:0,reads:0,provider:0,writes:0});
  }
 });
}
test('100 sequential paid webhook replays perform zero provider calls and ledger writes',async()=>{
 const h=harness('sumup-webhook',{},'paid');
 for(let i=0;i<100;i++)assert.equal((await h.invoke()).status,204);
 assert.equal(h.calls.reads,100);assert.equal(h.calls.provider,0);assert.equal(h.calls.writes,0);
});
test('pending webhook still verifies provider and reconciles exactly once',async()=>{
 const h=harness('sumup-webhook');assert.equal((await h.invoke()).status,204);
 assert.equal(h.calls.provider,1);assert.equal(h.calls.writes,1);
});
test('paid fast path cannot bypass restaurant verification',async()=>{
 const h=harness('sumup-webhook',{RC_SUMUP_RESTAURANT_USER_ID:'e6c2426f-b34d-4e5a-9149-e63327c86255'},'paid');
 assert.equal((await h.invoke()).status,503);assert.equal(h.calls.provider,0);assert.equal(h.calls.writes,0);
});
test('valid checkout configuration reaches order lookup without granting access',async()=>{
 const h=harness('sumup-checkout');assert.equal((await h.invoke()).status,404);
 assert.equal(h.calls.clients,1);assert.equal(h.calls.reads,1);assert.equal(h.calls.writes,0);
});
