import test from "node:test";
import assert from "node:assert/strict";
import { inventoryMovement, calculateInventoryBalance, inventoryQuantity } from "../../inventory/ledger.mjs";

const base = { restaurantId: "restaurant-A", productId: "coffee", movementId: "receipt-1", type: "receipt", quantity: 10 };
test("inventory: receipts, sales, waste and returns reconcile to three decimals", () => {
  const result = calculateInventoryBalance("restaurant-A", "coffee", [
    base,
    { ...base, movementId: "sale-1", type: "sale", quantity: 2.125 },
    { ...base, movementId: "waste-1", type: "waste", quantity: 0.5 },
    { ...base, movementId: "return-1", type: "return", quantity: 0.125 },
  ]);
  assert.equal(result.quantity, 7.5);
  assert.equal(result.movementCount, 4);
});
test("inventory: retrying same movement never double deducts stock", () => {
  const result = calculateInventoryBalance("restaurant-A", "coffee", [base, base]);
  assert.equal(result.quantity, 10);
  assert.equal(result.movementCount, 1);
});
test("inventory: conflicting retry is rejected", () => {
  assert.throws(() => calculateInventoryBalance("restaurant-A", "coffee", [base, { ...base, quantity: 9 }]), /CONFLICTING/);
});
test("inventory: cross restaurant and product contamination rejected", () => {
  assert.throws(() => calculateInventoryBalance("restaurant-B", "coffee", [base]), /CROSS_RESTAURANT/);
  assert.throws(() => calculateInventoryBalance("restaurant-A", "rice", [base]), /CROSS_RESTAURANT/);
});
test("inventory: negative stock is explicitly reported, never hidden", () => {
  const result = calculateInventoryBalance("restaurant-A", "coffee", [{ ...base, type: "sale", quantity: 1 }]);
  assert.equal(result.quantity, -1);
  assert.equal(result.negativeStock, true);
});
test("inventory: invalid quantities, ids and types fail closed", () => {
  for (const quantity of [-1, NaN, Infinity, "10", 1_000_000_001]) {
    assert.throws(() => inventoryQuantity(quantity));
  }
  assert.throws(() => inventoryMovement({ ...base, type: "transfer" }));
  assert.throws(() => inventoryMovement({ ...base, restaurantId: "" }));
  assert.throws(() => inventoryMovement({ ...base, quantity: 0 }));
});
