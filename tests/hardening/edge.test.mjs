import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {edgeHarness} from '../support/edge-harness.mjs';
const R=randomUUID(),U=randomUUID();
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-private-service',SUPABASE_ANON_KEY:'fixture-public-key'};
const payload=()=>({p_id:randomUUID(),p_user_id:R,p_public_token:'private-order-token-32-characters',p_customer_name:'Test',p_order_type:'Recoger en el punto',p_order_json:{paymentMethod:'Pago al recoger',customerUserId:'spoofed',items:[{product_id:'dish',quantity:1}]},p_total:0});
function orderHandler({quota=true,authError=false,userId=U,orderError=null}={}){
 const calls=[];const handler=edgeHarness('supabase/functions/create-customer-order/index.ts',{env,createClient:()=>({auth:{getUser:async()=>({data:{user:authError?null:{id:userId}},error:authError?{}:null})},rpc:async(name,params)=>{calls.push({name,params});return name.includes('consume')?{data:quota,error:null}:{data:orderError?null:[{id:params.p_id,public_token:params.p_public_token}],error:orderError};}})});return {handler,calls};
}
const request=(data,headers={})=>new Request('https://fixture.supabase.co/functions/v1/create-customer-order',{method:'POST',headers:{'content-type':'application/json',origin:'https://rincon-colombiano-pedidosapp.vercel.app',...headers},body:JSON.stringify(data)});
test('actual Edge: guest may place safe customer order; spoofed authenticated identity is ignored',async()=>{
 const h=orderHandler();const p=payload();const r=await h.handler(request(p));assert.equal(r.status,200);assert.equal((await r.json()).id,p.p_id);
 const call=h.calls.find(c=>c.name==='rc_ordera_create_customer_order_edge');assert.equal(call.params.p_customer_user_id,null);assert.equal(call.params.p_user_id,R);
 assert.match(h.calls[0].params.p_network_hash,/^[0-9a-f]{64}$/);assert.notEqual(h.calls[0].params.p_device_hash,h.calls[0].params.p_network_hash);
});
test('actual Edge: valid JWT identity comes from getUser, invalid JWT cannot degrade to guest',async()=>{
 let h=orderHandler();assert.equal((await h.handler(request(payload(),{authorization:'Bearer fixture-user-session'}))).status,200);
 assert.equal(h.calls.at(-1).params.p_customer_user_id,U);
 h=orderHandler({authError:true});assert.equal((await h.handler(request(payload(),{authorization:'Bearer invalid-user-session'}))).status,401);
 assert.ok(!h.calls.some(c=>c.name==='rc_ordera_create_customer_order_edge'));
});
test('actual Edge: malicious Origin, oversized body and persistent quota reject before order creation',async()=>{
 let h=orderHandler();assert.equal((await h.handler(request(payload(),{origin:'https://evil.invalid'}))).status,403);assert.equal(h.calls.length,0);
 assert.equal((await h.handler(request(payload(),{'content-length':'300000'}))).status,413);assert.equal(h.calls.length,0);
 h=orderHandler({quota:false});assert.equal((await h.handler(request(payload()))).status,429);assert.ok(!h.calls.some(c=>c.name==='rc_ordera_create_customer_order_edge'));
});
test('actual delivery webhook is disabled by default; invalid signature cannot create operational data',async()=>{
 let clients=0;const client=()=>{clients++;throw new Error('should not reach database');};
 let h=edgeHarness('supabase/functions/external-delivery-webhook/index.ts',{env,createClient:client});
 const body='{}';assert.equal((await h(new Request('https://fixture/webhook',{method:'POST',body}))).status,503);
 h=edgeHarness('supabase/functions/external-delivery-webhook/index.ts',{env:{...env,RC_EXTERNAL_TEST_ENABLED:'true',RC_EXTERNAL_TEST_SECRET:'fixture-test-secret-that-is-32-characters',RC_EXTERNAL_TEST_RESTAURANT_ID:R},createClient:client});
 const r=await h(new Request('https://fixture/webhook',{method:'POST',body,headers:{'x-rc-timestamp':String(Math.floor(Date.now()/1000)),'x-rc-signature':'0'.repeat(64)}}));
 assert.notEqual(r.status,200);assert.equal(clients,0);
});
test('actual Stripe handler rejects absent/invalid signature before any DB or settlement call',async()=>{
 let clients=0;const h=edgeHarness('supabase/functions/marketplace-webhook/index.ts',{env:{...env,STRIPE_WEBHOOK_SECRET:'fixture-webhook-secret',PAYMENT_SETTLEMENT_SECRET:'fixture-settlement-secret'},createClient:()=>{clients++;throw new Error('database forbidden');}});
 for(const signature of ['',`t=${Math.floor(Date.now()/1000)},v1=${'0'.repeat(64)}`]){
  const r=await h(new Request('https://fixture/webhook',{method:'POST',body:'{}',headers:{'stripe-signature':signature}}));assert.equal(r.status,400);
 }
 assert.equal(clients,0);
});
