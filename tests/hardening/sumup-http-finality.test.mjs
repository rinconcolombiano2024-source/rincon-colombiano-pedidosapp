import test from 'node:test';
import assert from 'node:assert/strict';
import {createSumUpHostedCheckout,retrieveSumUpCheckout,findSumUpCheckoutForAttempt} from '../../supabase/functions/_shared/sumup-hosted.ts';
import {inspectSumUpWebhook} from '../../supabase/functions/_shared/sumup-webhook.ts';

// SumUp OpenAPI: creation returns 201; list/retrieve return 200.
// https://github.com/sumup/sumup-openapi/blob/main/openapi.json
const orderId='e6c2426f-b34d-4e5a-9149-e63327c86255';
const checkoutId='64553e20-3f0e-49e4-8af3-fd0eca86ce91';
const config={merchantCode:'MCXXXXXX',apiKey:'test-only-key',appOrigin:'https://example.com'};
const attempt={orderId,attemptNumber:3,amountMinor:12345,currency:'PLN'};
const checkout={id:checkoutId,amount:123.45,currency:'PLN',merchant_code:config.merchantCode,
 checkout_reference:`rc-${orderId}-3`,status:'PENDING',hosted_checkout_url:`https://checkout.sumup.com/pay/${checkoutId}`};
const paid={...checkout,status:'PAID'};

for (const status of [200,202,203,206,207]) {
 test(`creation rejects HTTP ${status} before reading JSON, without retry`,async()=>{
  let requests=0,reads=0;
  const fetcher=async()=>{requests++;const response=new Response(JSON.stringify(checkout),{status});
   response.json=async()=>{reads++;return checkout};return response;};
  await assert.rejects(createSumUpHostedCheckout(config,attempt,fetcher),/SUMUP_API_UNAVAILABLE/);
  assert.equal(requests,1);assert.equal(reads,0);
 });
}
for (const status of [201,202,203,206,207]) {
 test(`lookup rejects paid JSON on HTTP ${status}, without retry`,async()=>{
  let requests=0;
  await assert.rejects(retrieveSumUpCheckout(checkoutId,config,attempt,async()=>{
   requests++;return new Response(JSON.stringify(paid),{status});}),/SUMUP_API_UNAVAILABLE/);
  assert.equal(requests,1);
 });
}
test('webhook cannot emit verified_only from a nonfinal HTTP 202 response',async()=>{
 await assert.rejects(inspectSumUpWebhook({event_type:'CHECKOUT_STATUS_CHANGED',id:checkoutId},
  async()=>({checkoutId,attempt}),config,async()=>new Response(JSON.stringify(paid),{status:202})),/SUMUP_API_UNAVAILABLE/);
});
test('recovery rejects nonfinal list and stops before retrieving detail',async()=>{
 let requests=0;
 await assert.rejects(findSumUpCheckoutForAttempt(config,attempt,async()=>{
  requests++;return new Response(JSON.stringify(requests===1?[paid]:paid),{status:202});}),/SUMUP_API_UNAVAILABLE/);
 assert.equal(requests,1);
});
test('recovery rejects nonfinal detail after a valid list',async()=>{
 let requests=0;
 await assert.rejects(findSumUpCheckoutForAttempt(config,attempt,async()=>{
  requests++;return new Response(JSON.stringify(requests===1?[paid]:paid),{status:requests===1?200:202});}),/SUMUP_API_UNAVAILABLE/);
 assert.equal(requests,2);
});
test('documented creation and retrieval statuses remain accepted',async()=>{
 assert.equal((await createSumUpHostedCheckout(config,attempt,async()=>new Response(JSON.stringify(checkout),{status:201}))).id,checkoutId);
 assert.equal((await retrieveSumUpCheckout(checkoutId,config,attempt,async()=>new Response(JSON.stringify(paid),{status:200}))).paid,true);
});
