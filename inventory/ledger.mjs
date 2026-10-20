// Inventory domain primitives: no network calls, side effects, or payment mutations.
// Persist movements in an authenticated, restaurant-scoped backend before enabling UI.
const MAX_SAFE_QUANTITY = 1_000_000_000;
export function inventoryQuantity(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_SAFE_QUANTITY) {
    throw new RangeError("INVALID_INVENTORY_QUANTITY");
  }
  return Math.round((value + Number.EPSILON) * 1000);
}
export function inventoryMovement(input) {
  if (!input || typeof input !== "object") throw new TypeError("INVALID_INVENTORY_MOVEMENT");
  const { restaurantId, productId, movementId, type, quantity, referenceId } = input;
  for (const id of [restaurantId, productId, movementId]) {
    if (typeof id !== "string" || !id.trim() || id.length > 128) throw new TypeError("INVALID_INVENTORY_ID");
  }
  if (!["receipt", "sale", "waste", "adjustment_in", "adjustment_out", "return"].includes(type)) {
    throw new TypeError("INVALID_INVENTORY_MOVEMENT_TYPE");
  }
  const milliQuantity = inventoryQuantity(quantity);
  if (milliQuantity <= 0) throw new RangeError("INVALID_INVENTORY_QUANTITY");
  if (referenceId != null && (typeof referenceId !== "string" || referenceId.length > 128)) {
    throw new TypeError("INVALID_INVENTORY_REFERENCE");
  }
  return Object.freeze({
    restaurantId: restaurantId.trim(), productId: productId.trim(), movementId: movementId.trim(),
    type, milliQuantity, referenceId: referenceId ?? null,
  });
}
export function calculateInventoryBalance(restaurantId, productId, movements) {
  if (typeof restaurantId !== "string" || !restaurantId.trim() || typeof productId !== "string" || !productId.trim()) {
    throw new TypeError("INVALID_INVENTORY_ID");
  }
  if (!Array.isArray(movements)) throw new TypeError("INVALID_INVENTORY_MOVEMENTS");
  restaurantId = restaurantId.trim();
  productId = productId.trim();
  let milliBalance = 0;
  const seen = new Map();
  for (const raw of movements) {
    const item = inventoryMovement(raw);
    if (item.restaurantId !== restaurantId || item.productId !== productId) {
      throw new Error("CROSS_RESTAURANT_OR_PRODUCT_MOVEMENT");
    }
    const previous = seen.get(item.movementId);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(item)) throw new Error("CONFLICTING_INVENTORY_MOVEMENT");
      continue; // identical retry is idempotent
    }
    seen.set(item.movementId, item);
    const sign = ["receipt", "adjustment_in", "return"].includes(item.type) ? 1 : -1;
    milliBalance += sign * item.milliQuantity;
    if (!Number.isSafeInteger(milliBalance)) throw new RangeError("INVENTORY_BALANCE_OVERFLOW");
  }
  return Object.freeze({ restaurantId, productId, quantity: milliBalance / 1000, negativeStock: milliBalance < 0, movementCount: seen.size });
}
