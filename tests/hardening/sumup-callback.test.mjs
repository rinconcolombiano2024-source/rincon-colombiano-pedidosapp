import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createSumUpHostedCheckout} from "../../supabase/functions/_shared/sumup-hosted.ts";
const orderId="e6c2426f-b34d-4e5a-9149-e63327c86255",checkoutId="64553e20-3f0e-49e4-8af3-fd0eca86ce91";
const webhookUrl="https://ouulrehcgmfbettseibn.supabase.co/functions/v1/sumup-webhook";
const attempt={orderId,attemptNumber:1,amountMinor:1250,currency:"PLN"};
const config={apiKey:"fixture-test-only",merchantCode:"MCXXXXXX",
 appOrigin:"https://rincon-colombiano-pedidosapp.vercel.app",webhookUrl};
const fake=async(url,opts)=>{
 assert.equal(url,"https://api.sumup.com/v0.1/checkouts");
 const request=JSON.parse(opts.body);
 assert.equal(request.return_url,webhookUrl);
 assert.equal(request.amount,12.5);
 assert.equal(request.checkout_reference,`rc-${orderId}-1`);
 return new Response(JSON.stringify({id:checkoutId,amount:12.5,currency:"PLN",
 merchant_code:config.merchantCode,checkout_reference:request.checkout_reference,
 status:"PENDING",hosted_checkout:{enabled:true},
 hosted_checkout_url:`https://checkout.sumup.com/pay/${checkoutId}`}),{status:201});
};
test("SumUp hosted creation embeds only validated official webhook callback",async()=>{
 const result=await createSumUpHostedCheckout(config,attempt,fake);
 assert.equal(result.status,"PENDING");
});
test("untrusted webhook URLs are rejected without a POST",async()=>{
 for(const malicious of [
  "https://ouulrehcgmfbettseibn.supabase.co.evil.invalid/functions/v1/sumup-webhook",
  "http://ouulrehcgmfbettseibn.supabase.co/functions/v1/sumup-webhook",
  "https://ouulrehcgmfbettseibn.supabase.co/functions/v1/sumup-webhook?next=evil",
  "https://ouulrehcgmfbettseibn.supabase.co@evil.invalid/functions/v1/sumup-webhook",
 ]) {
  let requests=0;
  await assert.rejects(()=>createSumUpHostedCheckout({...config,webhookUrl:malicious},attempt,async()=>{requests++;return fake();}));
  assert.equal(requests,0,malicious);
 }
});
test("both Edge routes remain explicitly disabled until secrets and merchant whitelist",()=>{
 const checkout=readFileSync("supabase/functions/sumup-checkout/index.ts","utf8");
 const webhook=readFileSync("supabase/functions/sumup-webhook/index.ts","utf8");
 const sql=readFileSync("MIGRACION-V91-73-SUMUP-SINGLE-MERCHANT-LEDGER.sql","utf8");
 for(const source of [checkout,webhook]){
  assert.match(source,/RC_SUMUP_PAYMENTS_ENABLED/);
  assert.match(source,/RC_SUMUP_RESTAURANT_USER_ID/);
  assert.match(source,/SUMUP_API_KEY/);
  assert.match(source,/SUMUP_MERCHANT_CODE/);
 }
 assert.match(checkout,/rc_sumup_reserve_checkout/);
 assert.match(webhook,/inspectSumUpWebhook/);
 assert.match(webhook,/rc_sumup_apply_verified_checkout/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.rc_sumup_/);
 assert.doesNotMatch(checkout,/STRIPE_SECRET_KEY|stripe\.com/);
});
