// Read-only recipe cost preview using the existing FIFO engine.
// No stock mutation, pricing override, or database access occurs here.
import { fifoIssue } from "./fifo.mjs";

export function previewRecipeCost({ restaurantId, portions = 1, ingredients }) {
  if (typeof restaurantId !== "string" || !restaurantId.trim()) throw new TypeError("INVALID_RESTAURANT");
  if (!Number.isSafeInteger(portions) || portions < 1 || portions > 100000) throw new RangeError("INVALID_PORTIONS");
  if (!Array.isArray(ingredients) || ingredients.length === 0) throw new TypeError("INVALID_RECIPE");
  const seen = new Set();
  const lines = [];
  let totalCostMinor = 0;
  for (const item of ingredients) {
    if (!item || typeof item !== "object" || typeof item.ingredientId !== "string" ||
        typeof item.warehouseId !== "string") throw new TypeError("INVALID_RECIPE_LINE");
    const key = JSON.stringify([item.warehouseId, item.ingredientId]);
    if (seen.has(key)) throw new Error("DUPLICATE_RECIPE_LINE");
    seen.add(key);
    const quantity = item.quantity * portions;
    if (!Number.isFinite(quantity) || quantity <= 0) throw new RangeError("INVALID_RECIPE_QUANTITY");
    const issue = fifoIssue({
      restaurantId, warehouseId: item.warehouseId, ingredientId: item.ingredientId,
      lots: item.lots, quantity,
    });
    if (!Number.isSafeInteger(totalCostMinor + issue.totalCostMinor)) throw new RangeError("RECIPE_COST_OVERFLOW");
    totalCostMinor += issue.totalCostMinor;
    lines.push(Object.freeze({
      ingredientId: item.ingredientId, warehouseId: item.warehouseId,
      quantity, costMinor: issue.totalCostMinor, allocations: issue.allocations,
    }));
  }
  return Object.freeze({ restaurantId, portions, totalCostMinor, lines: Object.freeze(lines) });
}
