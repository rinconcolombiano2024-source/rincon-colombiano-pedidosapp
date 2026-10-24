// Pure, side-effect-free inventory calculations. No database writes or stock mutations.
const quantity = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(name);
  return value;
};
const identifier = (value, name) => {
  if (typeof value !== "string" || !value.trim() || value.length > 128) throw new TypeError(name);
  return value.trim();
};
/** Quantities use integer millibase units (1000 = 1 g, ml, or item). */
export function reorderRecommendation({ restaurantId, warehouseId, ingredientId, onHandMilli, dailyUsageMilli, leadDays, safetyDays = 1, minimumMilli = 0 }) {
  const scope = { restaurantId: identifier(restaurantId, "INVALID_RESTAURANT"), warehouseId: identifier(warehouseId, "INVALID_WAREHOUSE"), ingredientId: identifier(ingredientId, "INVALID_INGREDIENT") };
  const stock = quantity(onHandMilli, "INVALID_STOCK");
  const daily = quantity(dailyUsageMilli, "INVALID_USAGE");
  const min = quantity(minimumMilli, "INVALID_MINIMUM");
  if (!Number.isSafeInteger(leadDays) || leadDays < 0 || leadDays > 365 || !Number.isSafeInteger(safetyDays) || safetyDays < 0 || safetyDays > 365) throw new RangeError("INVALID_LEAD_DAYS");
  const threshold = Math.max(min, daily * (leadDays + safetyDays));
  if (!Number.isSafeInteger(threshold)) throw new RangeError("REORDER_OVERFLOW");
  return Object.freeze({ ...scope, reorderPointMilli: threshold, needsReorder: stock <= threshold, suggestedOrderMilli: Math.max(0, threshold + daily * leadDays - stock) });
}
/** Blind count reconciliation preview; NEVER adjusts inventory without an authorized transaction. */
export function blindCountVariance({ restaurantId, warehouseId, ingredientId, theoreticalMilli, countedMilli, bookValueMinor }) {
  const scope = { restaurantId: identifier(restaurantId, "INVALID_RESTAURANT"), warehouseId: identifier(warehouseId, "INVALID_WAREHOUSE"), ingredientId: identifier(ingredientId, "INVALID_INGREDIENT") };
  const theoretical = quantity(theoreticalMilli, "INVALID_THEORETICAL");
  const counted = quantity(countedMilli, "INVALID_COUNT");
  const value = quantity(bookValueMinor, "INVALID_BOOK_VALUE");
  if (!theoretical && value) throw new RangeError("INVALID_BOOK_VALUE");
  const delta = counted - theoretical;
  const financialDifferenceMinor = theoretical ? Math.round(value * delta / theoretical) : null;
  if (financialDifferenceMinor !== null && !Number.isSafeInteger(financialDifferenceMinor)) throw new RangeError("VARIANCE_OVERFLOW");
  return Object.freeze({ ...scope, differenceMilli: delta, deviationPercent: theoretical ? delta / theoretical * 100 : counted ? null : 0, financialDifferenceMinor, requiresReview: delta !== 0 });
}
