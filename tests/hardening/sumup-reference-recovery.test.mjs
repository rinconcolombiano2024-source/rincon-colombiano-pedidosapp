import test from 'node:test';
import assert from 'node:assert/strict';
import {findSumUpCheckoutForAttempt} from '../../supabase/functions/_shared/sumup-hosted.ts';
const orderId='e6c2426f-b34d-4e5a-9149-e63327c86255',checkoutId='64553e20-3f0e-49e4-8af3-fd0eca86ce91';
const config={apiKey:'test-only',merchantCode:'MCXXXXXX',appOrigin:'https://example.invalid'};
const attempt={orderId,attemptNumber:1,amountMinor:1250,currency:'PLN'};
const detail={id:checkoutId,checkout_reference:`rc-${orderId}-1`,merchant_code:config.merchantCode,amount:12.5,
 currency:'PLN',status:'PAID'};
test('lost checkout recovered through reference lookup then exact identity GET, never POST',async()=>{
 const calls=[];const fetcher=async(url,options)=>{
   calls.push({url,options});assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
   return new Response(JSON.stringify(calls.length===1?[detail]:detail));
 };
 const result=await findSumUpCheckoutForAttempt(config,attempt,fetcher);
 assert.equal(result.providerStatus,'PAID');assert.equal(result.checkoutId,checkoutId);assert.equal(result.hostedUrl,null);
 assert.equal(new URL(calls[0].url).searchParams.get('checkout_reference'),`rc-${orderId}-1`);
 assert.equal(calls[1].url,`https://api.sumup.com/v0.1/checkouts/${checkoutId}`);
});
test('empty lookup never authorizes another POST; ambiguous results fail closed',async()=>{
 assert.equal(await findSumUpCheckoutForAttempt(config,attempt,async()=>new Response('[]')),null);
 await assert.rejects(()=>findSumUpCheckoutForAttempt(config,attempt,async()=>new Response(JSON.stringify([detail,detail]))),/AMBIGUOUS/);
});
test('mismatched merchant, amount or reference stops before detailed lookup',async()=>{
 for(const changed of [{...detail,merchant_code:'WRONG'},{...detail,amount:12.500000001},{...detail,checkout_reference:'foreign'}]){
   let reads=0;await assert.rejects(()=>findSumUpCheckoutForAttempt(config,attempt,async()=>{reads++;return new Response(JSON.stringify([changed]));}));
   assert.equal(reads,1);
 }
});
test('pending checkout requires verified hosted configuration, with independent page UUID',async()=>{
 let reads=0;const pending={...detail,status:'PENDING',hosted_checkout:{enabled:true},
   hosted_checkout_url:'https://checkout.sumup.com/pay/8f9316a3-cda9-42a9-9771-54d534315676'};
 const result=await findSumUpCheckoutForAttempt(config,attempt,async()=>new Response(JSON.stringify(++reads===1?[pending]:pending)));
 assert.equal(result.hostedUrl,pending.hosted_checkout_url);
});
test('detail identity drift and provider errors cannot become paid',async()=>{
 let reads=0;await assert.rejects(()=>findSumUpCheckoutForAttempt(config,attempt,async()=>new Response(JSON.stringify(++reads===1?[detail]:{...detail,id:orderId}))));
 await assert.rejects(()=>findSumUpCheckoutForAttempt(config,attempt,async()=>new Response('{}',{status:503})),/API_UNAVAILABLE/);
});
