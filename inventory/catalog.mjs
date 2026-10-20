// Side-effect-free inventory catalog validation. Persistence and authorization belong to the backend.
const UNITS = new Set(["unit", "g", "kg", "ml", "l"]);
const CURRENCIES = new Set(["PLN", "COP"]);
function identifier(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 128) throw new TypeError("INVALID_INVENTORY_ID");
  return value.trim();
}
function money(value) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw new RangeError("INVALID_INVENTORY_MONEY");
  }
  return value;
}
export function inventoryProduct(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("INVALID_INVENTORY_PRODUCT");
  const restaurantId = identifier(input.restaurantId);
  const productId = identifier(input.productId);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 160 || /[<>]/.test(name)) throw new TypeError("INVALID_INVENTORY_NAME");
  if (!UNITS.has(input.unit)) throw new TypeError("INVALID_INVENTORY_UNIT");
  if (!CURRENCIES.has(input.currency)) throw new TypeError("INVALID_INVENTORY_CURRENCY");
  if (typeof input.available !== "boolean") throw new TypeError("INVALID_INVENTORY_AVAILABILITY");
  const minStock = input.minStock ?? 0;
  if (typeof minStock !== "number" || !Number.isFinite(minStock) || minStock < 0 || minStock > 1_000_000_000 ||
      Math.abs(minStock * 1000 - Math.round(minStock * 1000)) > 1e-7) throw new RangeError("INVALID_INVENTORY_MIN_STOCK");
  return Object.freeze({
    restaurantId, productId, name, unit: input.unit, currency: input.currency,
    purchasePriceMinor: money(input.purchasePriceMinor),
    available: input.available, minStock,
  });
}
export function inventoryAvailability(product, balance) {
  const item = inventoryProduct(product);
  if (!balance || balance.restaurantId !== item.restaurantId || balance.productId !== item.productId ||
      typeof balance.quantity !== "number" || !Number.isFinite(balance.quantity)) {
    throw new Error("INVENTORY_SCOPE_MISMATCH");
  }
  return Object.freeze({
    restaurantId: item.restaurantId, productId: item.productId,
    available: item.available && balance.quantity > 0,
    lowStock: balance.quantity <= item.minStock,
    quantity: balance.quantity,
  });
}
