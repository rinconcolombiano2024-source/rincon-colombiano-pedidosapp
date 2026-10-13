"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

const root = join(__dirname, "..");
const source = readFileSync(join(root, "app.js"), "utf8");
assert.equal(source, readFileSync(join(root, "www/app.js"), "utf8"));
const start = source.indexOf("const CLIENT_TRACKING_MIN_READ_GAP_MS = ");
const end = source.indexOf("async function refreshClientOrders(", start);
assert.ok(start > 0 && end > start, "tracking function and cache not found");
const chunk = source.slice(start, end);

function harness() {
  let now = 10_000, calls = 0, fail = false;
  const client = {
    rpc: async () => {
      calls++;
      if (fail) return { error: new Error("TEST_FAILURE"), data: null };
      return { data: [{ customer_order_id: "order-one", courier_assignment_status: "accepted" }], error: null };
    },
  };
  const context = vm.createContext({
    cloudState: { client, user: { id: "restaurant-one" } },
    navigator: { onLine: true },
    clientOrdersTrackingInFlight: null,
    clientDeliveryTrackingByOrderId: new Map(),
    withCloudTimeout: async (operation) => operation,
    console: { error: () => {} },
    Date: { now: () => now },
    Map,
  });
  vm.runInContext(chunk, context, { filename: "app.js:delivery-tracking-cache" });
  return { context, client, calls: () => calls, advance: delta => { now += delta; }, fail: value => { fail = value; } };
}

test("one Supabase RPC for 100 sequential tracking reads in a 3-second burst", async () => {
  const h = harness();
  for (let i = 0; i < 100; i++) {
    const result = await h.context.loadCurrentRestaurantDeliveryTracking();
    assert.equal(result.get("order-one").courier_assignment_status, "accepted");
  }
  assert.equal(h.calls(), 1);
  h.advance(3001);
  await h.context.loadCurrentRestaurantDeliveryTracking();
  assert.equal(h.calls(), 2, "cache must revalidate after bounded interval");
});

test("tracking cache is not shared between restaurant users or clients", async () => {
  const h = harness();
  await h.context.loadCurrentRestaurantDeliveryTracking();
  h.context.cloudState.user.id = "restaurant-two";
  await h.context.loadCurrentRestaurantDeliveryTracking();
  assert.equal(h.calls(), 2);
  h.context.cloudState.client = { rpc: h.client.rpc };
  await h.context.loadCurrentRestaurantDeliveryTracking();
  assert.equal(h.calls(), 3);
});

test("transient RPC errors do not poison the tracking cache", async () => {
  const h = harness();
  h.fail(true);
  await assert.rejects(h.context.loadCurrentRestaurantDeliveryTracking());
  h.fail(false);
  await h.context.loadCurrentRestaurantDeliveryTracking();
  assert.equal(h.calls(), 2);
});
