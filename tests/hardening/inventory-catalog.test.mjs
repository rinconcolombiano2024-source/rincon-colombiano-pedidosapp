import test from "node:test";
import assert from "node:assert/strict";
import { inventoryProduct, inventoryAvailability } from "../../inventory/catalog.mjs";
const base = { restaurantId: "rc", productId: "rice", name: "Arroz", unit: "kg", currency: "PLN", purchasePriceMinor: 1299, available: true, minStock: 2 };
test("catalog preserves purchase price separately from menu prices", () => {
  const item = inventoryProduct(base);
  assert.equal(item.purchasePriceMinor, 1299);
  assert.equal(Object.hasOwn(item, "salePriceMinor"), false);
  assert.equal(Object.isFrozen(item), true);
});
test("catalog allows explicit unavailable products and alerts for low stock", () => {
  const item = inventoryProduct({ ...base, available: false });
  const status = inventoryAvailability(item, { restaurantId: "rc", productId: "rice", quantity: 1.5 });
  assert.equal(status.available, false);
  assert.equal(status.lowStock, true);
});
test("catalog rejects cross-restaurant stock and untrusted prices", () => {
  assert.throws(() => inventoryAvailability(base, { restaurantId: "other", productId: "rice", quantity: 2 }), /SCOPE_MISMATCH/);
  for (const purchasePriceMinor of [-1, 12.5, NaN, Infinity, "1299"]) {
    assert.throws(() => inventoryProduct({ ...base, purchasePriceMinor }), /INVALID_INVENTORY_MONEY/);
  }
});
test("catalog enforces explicit units, currencies, quantity precision and safe names", () => {
  assert.throws(() => inventoryProduct({ ...base, unit: "box" }), /INVALID_INVENTORY_UNIT/);
  assert.throws(() => inventoryProduct({ ...base, currency: "EUR" }), /INVALID_INVENTORY_CURRENCY/);
  assert.throws(() => inventoryProduct({ ...base, minStock: 0.0001 }), /INVALID_INVENTORY_MIN_STOCK/);
  assert.throws(() => inventoryProduct({ ...base, name: "<script>" }), /INVALID_INVENTORY_NAME/);
  assert.throws(() => inventoryProduct({ ...base, available: "yes" }), /INVALID_INVENTORY_AVAILABILITY/);
});
