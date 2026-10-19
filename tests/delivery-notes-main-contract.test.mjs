import test from "node:test";
import assert from "node:assert/strict";
import { buildEvent } from "../delivery-bridge/src/canonical.mjs";

test("repeated external dishes keep independent notes, identifiers, and prices", () => {
  const event = buildEvent("test", {
    eventType: "order_created", orderId: "order-1", eventId: "event-1",
    items: [
      { externalId: "line-1", name: "Jugo", quantity: 1, unitPriceGrosz: 1500, notes: " Sin azúcar " },
      { externalId: "line-2", name: "Jugo", quantity: 1, unitPriceGrosz: 1500, notes: "Sin hielo" },
    ],
  });
  assert.deepEqual(event.items.map(({ externalId, notes, unitPriceGrosz }) => ({ externalId, notes, unitPriceGrosz })), [
    { externalId: "line-1", notes: "Sin azúcar", unitPriceGrosz: 1500 },
    { externalId: "line-2", notes: "Sin hielo", unitPriceGrosz: 1500 },
  ]);
});

test("external instructions are optional, bounded, and never coerced from objects", () => {
  const event = buildEvent("test", {
    eventType: "order_created", orderId: "order-2", eventId: "event-2",
    items: [
      { externalId: "a", name: "Arepa", quantity: 1, unitPriceGrosz: 500, notes: "x".repeat(600) },
      { externalId: "b", name: "Arepa", quantity: 1, unitPriceGrosz: 500 },
      { externalId: "c", name: "Arepa", quantity: 1, unitPriceGrosz: 500, notes: { malicious: true } },
    ],
  });
  assert.equal(event.items[0].notes.length, 500);
  assert.equal(event.items[1].notes, null);
  assert.equal(event.items[2].notes, null);
  assert.deepEqual(event.items.map((item) => item.unitPriceGrosz), [500, 500, 500]);
});
