import test from "node:test";
import assert from "node:assert/strict";
import { previewRecipeCost } from "../../inventory/recipe-cost.mjs";

const scope = { restaurantId: "r1", warehouseId: "fridge", ingredientId: "beef" };
const lot = { ...scope, lotId: "a", receivedAt: "2026-10-01T00:00:00Z", originalMilli: 3000, availableMilli: 3000, totalCostMinor: 6000 };
const recipe = { restaurantId: "r1", portions: 2, ingredients: [{ warehouseId: "fridge", ingredientId: "beef", quantity: 1, lots: [lot] }] };

test("recipe preview costs multiple portions using FIFO without mutating lots", () => {
  const before = structuredClone(lot);
  const result = previewRecipeCost(recipe);
  assert.equal(result.totalCostMinor, 4000);
  assert.equal(result.lines[0].allocations[0].usedMilli, 2000);
  assert.deepEqual(lot, before);
});

test("recipe preview refuses duplicate ingredient lines and stock overdraw", () => {
  assert.throws(() => previewRecipeCost({ ...recipe, ingredients: [...recipe.ingredients, ...recipe.ingredients] }), /DUPLICATE_RECIPE_LINE/);
  assert.throws(() => previewRecipeCost({ ...recipe, portions: 4 }), /INSUFFICIENT_STOCK/);
});

test("recipe preview rejects cross-restaurant lots and invalid quantities", () => {
  assert.throws(() => previewRecipeCost({ ...recipe, restaurantId: "other" }), /SCOPE_MISMATCH/);
  assert.throws(() => previewRecipeCost({ ...recipe, portions: 0 }), /INVALID_PORTIONS/);
  assert.throws(() => previewRecipeCost({ ...recipe, ingredients: [{ ...recipe.ingredients[0], quantity: -1 }] }), /INVALID_RECIPE_QUANTITY/);
});
