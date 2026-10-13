import test from "node:test";
import assert from "node:assert/strict";
import {
  referenceForAttempt,
  isTrustedSumUpHostedUrl,
  verifyHostedCheckout,
  verifyRetrievedCheckout,
  createSumUpHostedCheckout,
  retrieveSumUpCheckout,
} from "../../supabase/functions/_shared/sumup-hosted.ts";

const orderId = "e6c2426f-b34d-4e5a-9149-e63327c86255";
const checkoutId = "64553e20-3f0e-49e4-8af3-fd0eca86ce91";
const attempt = { orderId, attemptNumber: 3, amountMinor: 12345, currency: "PLN" };
const config = { merchantCode: "MCXXXXXX", apiKey: "secret-test-only", appOrigin: "https://rincon-colombiano-pedidosapp.vercel.app" };
const good = {
  id: checkoutId, amount: 123.45, currency: "PLN",
  merchant_code: config.merchantCode,
  checkout_reference: `rc-${orderId}-3`,
  hosted_checkout: { enabled: true },
  hosted_checkout_url: `https://checkout.sumup.com/pay/${checkoutId}`,
  status: "PENDING",
};

test("deterministic, bounded reference; no untrusted amount or attempt", () => {
  assert.equal(referenceForAttempt(attempt), good.checkout_reference);
  assert.equal(referenceForAttempt({...attempt,orderId:orderId.toUpperCase()}),good.checkout_reference);
  assert.throws(() => referenceForAttempt({ ...attempt, amountMinor: 0 }));
  assert.throws(() => referenceForAttempt({ ...attempt, amountMinor: 120.5 }));
  assert.throws(() => referenceForAttempt({ ...attempt, currency: "EUR" }));
  assert.throws(() => referenceForAttempt({ ...attempt, attemptNumber: 0 }));
  assert.throws(() => referenceForAttempt({ ...attempt, orderId: "fake" }));
});

test("accept exact HTTPS SumUp hosted checkout URL only", () => {
  assert.equal(isTrustedSumUpHostedUrl(good.hosted_checkout_url), true);
  for (const url of [
    "http://checkout.sumup.com/pay/" + checkoutId,
    "https://checkout.sumup.com.evil.com/pay/" + checkoutId,
    "https://checkout.sumup.com@evil.com/pay/" + checkoutId,
    "https://checkout.sumup.com/other/" + checkoutId,
    "https://checkout.sumup.com/pay/" + checkoutId + "?next=https://evil.com",
    "https://checkout.sumup.com/pay/" + "0".repeat(36),
    "javascript:alert(1)",
  ]) {
    assert.equal(isTrustedSumUpHostedUrl(url), false, url);
  }
});

test("provider checkout is rejected if financial or merchant fields drift", () => {
  assert.equal(verifyHostedCheckout(good, config, attempt).status, "PENDING");
  for (const key of ["amount", "currency", "merchant_code", "checkout_reference", "id", "status", "hosted_checkout_url"]) {
    assert.throws(() => verifyHostedCheckout({ ...good, [key]: null }, config, attempt), key);
  }
  assert.throws(() => verifyHostedCheckout({ ...good, amount: 123.46 }, config, attempt));
  assert.throws(() => verifyHostedCheckout({ ...good, amount: 123.4501 }, config, attempt));
  assert.throws(() => verifyHostedCheckout({ ...good, status: "PAID" }, config, attempt));
  assert.throws(() => verifyHostedCheckout({ ...good, hosted_checkout: { enabled: false } }, config, attempt));
});

test("provider amount rejects every nonzero fractional grosz without tolerance", () => {
  assert.throws(() => verifyHostedCheckout({ ...good, amount: 123.4500000001 }, config, attempt));
  assert.throws(() => verifyRetrievedCheckout({ ...good, amount: 123.4499999999, status: "PAID" }, checkoutId, config, attempt));
});

test("exact decimal provider values accept one grosz and large PLN boundaries", () => {
  for (const amountMinor of [1, 10, 29, 1990, 12345, 100000000]) {
    const input = { ...attempt, amountMinor };
    const result = verifyHostedCheckout({ ...good, amount: amountMinor / 100 }, config, input);
    assert.equal(result.id, checkoutId);
  }
});

test("returning from hosted checkout never marks paid; retrieve verifies amount, ID and status", () => {
  const pending = verifyRetrievedCheckout(good, checkoutId, config, attempt);
  assert.equal(pending.paid, false);
  assert.equal(verifyRetrievedCheckout({ ...good, status: "PAID" }, checkoutId, config, attempt).paid, true);
  assert.throws(() => verifyRetrievedCheckout({ ...good, amount: 5 }, checkoutId, config, attempt));
  assert.throws(() => verifyRetrievedCheckout(good, "other-checkout-id", config, attempt));
});

test("POST uses server credential, trusted return and correct PLN minor units", async () => {
  let seen = 0;
  const fetcher = async (url, options) => {
    seen++;
    assert.equal(url, "https://api.sumup.com/v0.1/checkouts");
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    const body = JSON.parse(options.body);
    assert.equal(body.amount, 123.45);
    assert.equal(body.currency, "PLN");
    assert.equal(body.checkout_reference, good.checkout_reference);
    assert.equal(body.redirect_url, config.appOrigin + "/cliente.html");
    assert.deepEqual(body.hosted_checkout, { enabled: true });
    assert.equal(options.headers.Authorization, "Bearer " + config.apiKey);
    return new Response(JSON.stringify(good), { status: 201 });
  };
  assert.equal((await createSumUpHostedCheckout(config, attempt, fetcher)).id, checkoutId);
  assert.equal(seen, 1);
});

test("provider failures are non-permissive; no automatic retries", async () => {
  let seen = 0;
  const fetcher = async () => {
    seen++;
    return new Response(JSON.stringify({ message: "sensitive-provider-response" }), { status: 400 });
  };
  await assert.rejects(createSumUpHostedCheckout(config, attempt, fetcher), /SUMUP_API_UNAVAILABLE/);
  assert.equal(seen, 1);
  await assert.rejects(createSumUpHostedCheckout({ ...config, appOrigin: "http://evil.com" }, attempt, fetcher));
  assert.equal(seen, 1);
});

test("GET lookup uses opaque UUID and refuses mismatched identity", async () => {
  let seen = 0;
  const fetcher = async (url, options) => {
    seen++;
    assert.equal(url, `https://api.sumup.com/v0.1/checkouts/${checkoutId}`);
    assert.equal(options.method, "GET");
    return new Response(JSON.stringify({ ...good, status: "PAID" }), { status: 200 });
  };
  assert.equal((await retrieveSumUpCheckout(checkoutId, config, attempt, fetcher)).paid, true);
  assert.equal(seen, 1);
  await assert.rejects(retrieveSumUpCheckout("evil?x=1", config, attempt, fetcher));
  assert.equal(seen, 1);
});
