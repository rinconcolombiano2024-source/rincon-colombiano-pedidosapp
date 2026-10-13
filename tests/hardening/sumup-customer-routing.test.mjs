import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('cliente.js','utf8');
const start=source.indexOf('function customerSafeStripeCheckoutUrl(');
const end=source.indexOf('async function customerConfirmDelivery(',start);
function harness(provider='sumup') {
  const calls=[],redirects=[]; let resolve;
  const gate=new Promise(r=>{resolve=r;});
  const context=vm.createContext({URL,RegExp,console:{error(){}},navigator:{onLine:true},
    customerSettings:{onlinePaymentProvider:provider},customerStoreId:'restaurant-a',customerUser:{id:'customer-a'},
    customerTrackedOrder:{id:'order-a'},customerT:x=>x,customerSetTrackingStatus(){},customerPersistTrackedOrder(){},
    window:{location:{assign:url=>redirects.push(url)}},
    customerClient:{functions:{invoke(name,options){calls.push({name,options});return gate;}}}});
  vm.runInContext(source.slice(start,end),context);
  return {context,calls,redirects,resolve};
}
const hosted='https://checkout.sumup.com/pay/8f9316a3-cda9-42a9-9771-54d534315676';
test('SumUp routes to existing endpoint without price, merchant or redirect parameters',async()=>{
 const h=harness(),p=h.context.customerStartOnlinePayment('order-a','private-token');
 assert.equal(h.calls[0].name,'sumup-checkout');
 assert.deepEqual(Object.keys(h.calls[0].options.body).sort(),['orderId','publicToken']);
 h.resolve({data:{url:hosted}});assert.equal(await p,true);assert.deepEqual(h.redirects,[hosted]);
});
test('Stripe preserves its existing route and only accepts Stripe URLs',async()=>{
 const h=harness('stripe'),p=h.context.customerStartOnlinePayment('order-a','token');
 assert.equal(h.calls[0].name,'marketplace-checkout');
 h.resolve({data:{url:hosted}});assert.equal(await p,false);assert.equal(h.redirects.length,0);
});
test('100 clicks share one invocation and one redirect',async()=>{
 const h=harness();const calls=Array.from({length:100},()=>h.context.customerStartOnlinePayment('order-a','token'));
 assert.equal(h.calls.length,1);h.resolve({data:{url:hosted}});await Promise.all(calls);assert.equal(h.redirects.length,1);
});
test('store, user, client or provider change prevents old redirect',async()=>{
 for(const change of [c=>c.customerStoreId='restaurant-b',c=>c.customerUser={id:'customer-b'},
   c=>c.customerClient={},c=>c.customerSettings.onlinePaymentProvider='stripe']) {
   const h=harness(),p=h.context.customerStartOnlinePayment('order-a','token');change(h.context);
   h.resolve({data:{url:hosted}});assert.equal(await p,false);assert.equal(h.redirects.length,0);
 }
});
test('a different operation cannot join or create a parallel checkout',async()=>{
 const h=harness(),p=h.context.customerStartOnlinePayment('order-a','token');
 assert.equal(await h.context.customerStartOnlinePayment('order-b','token'),false);
 assert.equal(h.calls.length,1);h.resolve({error:{message:'unavailable'}});assert.equal(await p,false);
});
test('disabled and unknown providers never invoke either PSP',async()=>{
 for(const provider of ['disabled','unknown','stripe.evil']) {
   const h=harness(provider);assert.equal(await h.context.customerStartOnlinePayment('order-a','token'),false);
   assert.equal(h.calls.length,0);
 }
});
test('SumUp redirects reject foreign origins, credentials, fragments and non-UUID pages',()=>{
 const h=harness();
 for(const url of ['http://checkout.sumup.com/pay/x','https://checkout.sumup.com.evil.invalid/pay/x',
   hosted+'?next=evil',hosted+'#fragment',hosted.replace('checkout.sumup.com','user@checkout.sumup.com'),
   'javascript:alert(1)','https://checkout.sumup.com/pay/not-a-uuid'])
   assert.equal(h.context.customerSafeProviderCheckoutUrl(url,'sumup'),'');
});
test('labels exist in all three languages without promising unverified payment methods',()=>{
 assert.equal((source.match(/onlinePaymentSumUp:/g)||[]).length,3);
 assert.equal((source.match(/onlinePaymentStripe:/g)||[]).length,3);
 assert.doesNotMatch(source,/onlinePayment:.*BLIK/);
});

test('recovery response causes a read, never a frontend paid mutation or redirect',async()=>{
 const h=harness();let reads=0;h.context.customerPollOrderStatus=async()=>{reads++;};
 const p=h.context.customerStartOnlinePayment('order-a','token');
 h.resolve({data:{reconciled:true,paymentStatus:'paid'}});assert.equal(await p,true);
 assert.equal(reads,1);assert.equal(h.redirects.length,0);
 assert.equal(h.context.customerTrackedOrder.paymentStatus,undefined);
});
