import test from "node:test";
import assert from "node:assert/strict";
import { referenceForAttempt, verifyRetrievedCheckout, verifyHostedCheckout } from "../../supabase/functions/_shared/sumup-hosted.ts";

const id = "e6c2426f-b34d-4e5a-9149-e63327c86255";
const checkoutId = "64553e20-3f0e-49e4-8af3-fd0eca86ce91";
const config = {merchantCode:"MCXXXXXX",apiKey:"test-token",appOrigin:"https://rincon-colombiano-pedidosapp.vercel.app"};
const attempt = {orderId:id,amountMinor:1250,attemptNumber:5,currency:"PLN"};
const checkout = {
  id:checkoutId,merchant_code:config.merchantCode,
  checkout_reference:`rc-${id}-5`,amount:12.50,currency:"PLN",
  status:"PENDING",hosted_checkout_url:`https://checkout.sumup.com/pay/${checkoutId}`,
};

test("SumUp decimal amount is exact in grosz; subcent payment is never accepted",()=>{
  assert.equal(verifyHostedCheckout(checkout,config,attempt).status,"PENDING");
  for(const amount of [12.500000001,12.499999999,12.501,12.499,0.01,13.00]){
    assert.throws(()=>verifyHostedCheckout({...checkout,amount},config,attempt),String(amount));
    assert.throws(()=>verifyRetrievedCheckout({...checkout,status:"PAID",amount},checkoutId,config,attempt),String(amount));
  }
});
test("SumUp order references canonicalize UUID case and forbid cross-order bindings",()=>{
  assert.equal(referenceForAttempt({...attempt,orderId:id.toUpperCase()}),checkout.checkout_reference);
  assert.throws(()=>verifyRetrievedCheckout({...checkout,checkout_reference:`rc-${id}-6`},checkoutId,config,attempt));
  assert.throws(()=>verifyRetrievedCheckout({...checkout,merchant_code:"OTHER"},checkoutId,config,attempt));
});
