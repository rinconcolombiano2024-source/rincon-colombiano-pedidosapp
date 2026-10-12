import test from "node:test";
import assert from "node:assert/strict";
import { inspectSumUpWebhook, parseSumUpWebhookEvent } from "../../supabase/functions/_shared/sumup-webhook.ts";

const orderId = "e6c2426f-b34d-4e5a-9149-e63327c86255";
const checkoutId = "64553e20-3f0e-49e4-8af3-fd0eca86ce91";
const attempt = { orderId, attemptNumber: 3, amountMinor: 12345, currency: "PLN" };
const config = { merchantCode: "MCXXXXXX", apiKey: "test-key-not-real", appOrigin: "https://rincon-colombiano-pedidosapp.vercel.app" };
const provider = {
  id: checkoutId, amount: 123.45, currency: "PLN", merchant_code: config.merchantCode,
  checkout_reference: `rc-${orderId}-3`, status: "PAID",
};
const reservation = { checkoutId, attempt };
const event = { event_type: "CHECKOUT_STATUS_CHANGED", id: checkoutId };
const mockProvider = async () => new Response(JSON.stringify(provider), { status: 200 });

test("ignore unknown future SumUp event types without querying our ledger", async () => {
  let lookups = 0;
  const result = await inspectSumUpWebhook({ event_type: "FUTURE_EVENT", id: "anything" }, () => {
    lookups++;
  }, config, mockProvider);
  assert.equal(result.kind, "ignored");
  assert.equal(lookups, 0);
});
test("strict event UUID and no trust in webhook status", async () => {
  assert.deepEqual(parseSumUpWebhookEvent(event), { eventType: "CHECKOUT_STATUS_CHANGED", checkoutId });
  for (const raw of [null, [], "x", { event_type: "CHECKOUT_STATUS_CHANGED", id: "wrong" }]) {
    assert.throws(() => parseSumUpWebhookEvent(raw));
  }
});
test("unknown checkout stops before fetching provider", async () => {
  let network = 0;
  const result = await inspectSumUpWebhook(event, async () => null, config, async () => { network++; });
  assert.equal(result.kind, "unknown_checkout");
  assert.equal(network, 0);
});
test("only DB-reserved attempt verified by SumUp can produce a read-only status", async () => {
  let requests = 0;
  const result = await inspectSumUpWebhook(
    { ...event, status: "FAILED", amount: 1, merchant_code: "ATTACKER" },
    async () => reservation,
    config,
    async (url, options) => {
      requests++;
      assert.equal(url, `https://api.sumup.com/v0.1/checkouts/${checkoutId}`);
      assert.equal(options.method, "GET");
      return mockProvider();
    },
  );
  assert.equal(requests, 1);
  assert.equal(result.kind, "verified_only");
  assert.equal(result.providerStatus, "PAID");
  assert.equal(result.orderId, orderId);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "paid"), false);
});
test("tampered ledger or provider merchant/amount blocks result", async () => {
  await assert.rejects(inspectSumUpWebhook(event, async () => ({ ...reservation, checkoutId: orderId }), config, mockProvider), /MISMATCH/);
  await assert.rejects(inspectSumUpWebhook(event, async () => reservation, config, async () =>
    new Response(JSON.stringify({ ...provider, amount: 12.34 }), { status: 200 })));
  await assert.rejects(inspectSumUpWebhook(event, async () => reservation, config, async () =>
    new Response(JSON.stringify({ ...provider, merchant_code: "WRONG" }), { status: 200 })));
});
