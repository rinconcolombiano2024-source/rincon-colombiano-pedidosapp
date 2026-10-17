import test from "node:test";
import assert from "node:assert/strict";
import { buildEvent } from "../../delivery-bridge/src/canonical.mjs";

test("external delivery retains separate instructions for identical products", () => {
  const event = buildEvent("test", {
    eventType: "order_created", orderId: "o-1", eventId: "e-1",
    items: [
      { externalId: "line-1", name: "Jugo", quantity: 1, unitPriceGrosz: 1500, notes: "Sin azúcar" },
      { externalId: "line-2", name: "Jugo", quantity: 1, unitPriceGrosz: 1500, notes: "Sin hielo" },
    ],
  });
  assert.equal(event.items[0].notes, "Sin azúcar");
  assert.equal(event.items[1].notes, "Sin hielo");
  assert.equal(event.items[0].unitPriceGrosz, 1500);
  assert.equal(event.items[1].unitPriceGrosz, 1500);
  assert.equal(event.items[0].externalId, "line-1");
  assert.equal(event.items[1].externalId, "line-2");
});

test("external delivery instructions remain bounded and optional", () => {
  const event = buildEvent("test", {
    eventType: "order_created", orderId: "o-2", eventId: "e-2",
    items: [
      { externalId: "a", name: "Arepa", quantity: 1, unitPriceGrosz: 500, notes: "x".repeat(600) },
      { externalId: "b", name: "Arepa", quantity: 1, unitPriceGrosz: 500 },
      { externalId: "c", name: "Arepa", quantity: 1, unitPriceGrosz: 500, notes: { malicious: true } },
    ],
  });
  assert.equal(event.items[0].notes.length, 500);
  assert.equal(event.items[1].notes, null);
  assert.equal(event.items[2].notes, null);
});
