import test from "node:test";
import assert from "node:assert/strict";
import { buildEvent } from "../../delivery-bridge/src/canonical.mjs";

// Regression contract: separate instructions must survive canonicalization
// without changing monetary amounts, identifiers or quantities.
test("two identical delivery items preserve independent special instructions", () => {
  const event = buildEvent("test", {
    eventType: "order_created", orderId: "order-1", eventId: "event-1",
    items: [
      { externalId: "line-a", name: "Jugo", quantity: 1, unitPriceGrosz: 1500, notes: "Sin azúcar" },
      { externalId: "line-b", name: "Jugo", quantity: 1, unitPriceGrosz: 1500, notes: "Sin hielo" }
    ]
  });
  assert.deepEqual(event.items.map(item => item.notes), ["Sin azúcar", "Sin hielo"]);
  assert.deepEqual(event.items.map(item => item.externalId), ["line-a", "line-b"]);
  assert.deepEqual(event.items.map(item => item.unitPriceGrosz), [1500, 1500]);
});

test("missing notes remain optional and never alter prices", () => {
  const event = buildEvent("test", {
    eventType: "order_created", orderId: "order-2", eventId: "event-2",
    items: [{ externalId: "line-a", name: "Arepa", quantity: 2, unitPriceGrosz: 500 }]
  });
  assert.equal(event.items[0].notes ?? null, null);
  assert.equal(event.items[0].quantity, 2);
  assert.equal(event.items[0].unitPriceGrosz, 500);
});
