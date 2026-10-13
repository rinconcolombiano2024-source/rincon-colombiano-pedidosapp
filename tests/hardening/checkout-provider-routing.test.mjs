import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {routeSumUpCheckout} from '../../supabase/functions/_shared/checkout-provider.ts';
const id='e6c2426f-b34d-4e5a-9149-e63327c86255';
const order={id,user_id:'restaurant',payment_provider:'',order_type:'Recoger en el punto',tip_amount:0,final_delivery_fee:0};
const env={RC_SUMUP_PAYMENTS_ENABLED:'1',RC_SUMUP_RESTAURANT_USER_ID:'restaurant',SUPABASE_URL:'https://ouulrehcgmfbettseibn.supabase.co'};
const url='https://checkout.sumup.com/pay/'+id;
function run(o=order,settings={onlinePaymentProvider:'sumup'},overrides={},fetcher=async()=>new Response(JSON.stringify({url}))){
 let reads=0,posts=0;
 const promise=routeSumUpCheckout(o,'guest-proof','Bearer original-token',n=>({...env,...overrides})[n],async()=>{reads++;return {data:{settings},error:null};},async(u,options)=>{posts++;assert.equal(u,env.SUPABASE_URL+'/functions/v1/sumup-checkout');assert.deepEqual(JSON.parse(options.body),{orderId:id,publicToken:'guest-proof'});assert.equal(options.headers.authorization,'Bearer original-token');assert.equal(options.redirect,'error');return fetcher();});
 return {promise,counts:()=>({reads,posts})};
}
test('selected SumUp routes with only order proof and declares provider',async()=>{const h=run();const r=await h.promise;assert.equal(r.status,200);assert.deepEqual(await r.json(),{url,provider:'sumup'});assert.deepEqual(h.counts(),{reads:1,posts:1});});
test('disabled, unrelated restaurant and existing Stripe avoid extra settings reads',async()=>{
 for(const [o,e] of [[order,{RC_SUMUP_PAYMENTS_ENABLED:'0'}],[{...order,user_id:'other'},{}],[{...order,payment_provider:'stripe_connect'},{}]]){const h=run(o,{},e);assert.equal(await h.promise,null);assert.deepEqual(h.counts(),{reads:0,posts:0});}
});
test('reserved SumUp cannot fall back to Stripe when disabled or settings changed',async()=>{
 for(const [settings,e] of [[{onlinePaymentProvider:'sumup'},{RC_SUMUP_PAYMENTS_ENABLED:'0'}],[{onlinePaymentProvider:'stripe'},{}]]){const h=run({...order,payment_provider:'sumup'},settings,e);assert.ok((await h.promise).status>=400);assert.equal(h.counts().posts,0);}
});
test('SumUp errors or hostile checkout URL never fall back',async()=>{
 for(const f of [async()=>new Response('{}',{status:503}),async()=>new Response(JSON.stringify({url:'https://evil.invalid'})),async()=>{throw Error('timeout');}]){const h=run(order,undefined,{},f);assert.equal((await h.promise).status,503);assert.equal(h.counts().posts,1);}
});
test('delivery, tips and delivery fees fail closed before provider call',async()=>{
 for(const o of [{...order,order_type:'Domicilio'},{...order,tip_amount:1},{...order,final_delivery_fee:5}]){const h=run(o);assert.equal((await h.promise).status,409);assert.equal(h.counts().posts,0);}
});
test('settings lookup failure cannot silently switch payment provider',async()=>{
 const r=await routeSumUpCheckout(order,'','',n=>env[n],async()=>({data:null,error:{message:'unavailable'}}),async()=>{throw Error('unexpected');});assert.equal(r.status,503);
});
for(const file of ['cliente.js','www/cliente.js'])test(file+': provider-specific redirect validation preserves Stripe',()=>{
 const s=readFileSync(file,'utf8'),ctx=vm.createContext({URL});vm.runInContext(s.slice(s.indexOf('function customerSafeStripeCheckoutUrl('),s.indexOf('async function customerStartOnlinePayment(')),ctx);
 assert.equal(ctx.customerSafeOnlineCheckoutUrl(url,'sumup'),url);
 assert.equal(ctx.customerSafeOnlineCheckoutUrl('https://checkout.stripe.com/c/pay/test'),'https://checkout.stripe.com/c/pay/test');
 for(const u of [url+'?next=evil',url+'#x',url.replace('checkout.sumup.com','evil.invalid'),url.replace('https:','http:'),'javascript:alert(1)'])assert.equal(ctx.customerSafeOnlineCheckoutUrl(u,'sumup'),'');
 assert.equal(ctx.customerSafeOnlineCheckoutUrl(url,'stripe'),'');assert.equal(ctx.customerSafeOnlineCheckoutUrl(url,'unknown'),'');
});
test('gateway dispatch is after ownership verification and before Stripe reservation',()=>{
 const s=readFileSync('supabase/functions/marketplace-checkout/index.ts','utf8');
 assert.ok(s.indexOf('const sumUpResponse')>s.indexOf('!authenticatedCustomer &&'));
 assert.ok(s.indexOf('const sumUpResponse')<s.indexOf('const existingProvider'));
 assert.match(s,/if \(sumUpResponse\) return sumUpResponse/);
});
test('actual gateway passes verified guest token and never dispatches unauthorized order',async()=>{
 const {stripTypeScriptTypes}=await import('node:module');
 for(const allowed of [true,false]){
  let handler,calls=0;
  const admin={auth:{getUser:async()=>({data:{user:null}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:order,error:null})})})}),rpc:async()=>({data:allowed,error:null})};
  const ctx=vm.createContext({Request,Response,URL,TextDecoder,Uint8Array,AbortSignal,console,
    Deno:{env:{get:n=>({...env,SUPABASE_SERVICE_ROLE_KEY:'fixture',APP_BASE_URL:'https://example.com'})[n]},serve:fn=>{handler=fn;}},
    createClient:()=>admin,withCors:fn=>fn,
    routeSumUpCheckout:async(o,token)=>{calls++;assert.equal(o.id,id);assert.equal(token,'guest-proof');return new Response(JSON.stringify({url,provider:'sumup'}));},
  });
  const source=readFileSync('supabase/functions/marketplace-checkout/index.ts','utf8').replace(/^import .*;\n/gm,'');
  vm.runInContext(stripTypeScriptTypes(source),ctx);
  const result=await handler(new Request('https://example.com',{method:'POST',body:JSON.stringify({orderId:id,publicToken:'guest-proof'})}));
  assert.equal(result.status,allowed?200:403);assert.equal(calls,allowed?1:0);
 }
});
