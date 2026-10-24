import test from "node:test";
import assert from "node:assert/strict";
import { reorderRecommendation, blindCountVariance } from "../../inventory/reorder-count.mjs";
const scope = { restaurantId: "rc", warehouseId: "cold", ingredientId: "beef" };
test("reorder point follows average usage and supplier lead time", () => {
 const x = reorderRecommendation({ ...scope, onHandMilli: 2000, dailyUsageMilli: 1000, leadDays: 3, safetyDays: 2 });
 assert.equal(x.reorderPointMilli, 5000);
 assert.equal(x.needsReorder, true);
 assert.equal(x.suggestedOrderMilli, 6000);
});
test("stock above threshold needs no reorder", () => {
 const x = reorderRecommendation({ ...scope, onHandMilli: 12000, dailyUsageMilli: 1000, leadDays: 3 });
 assert.equal(x.needsReorder, false);
 assert.equal(x.suggestedOrderMilli, 0);
});
test("blind count shows negative stock and financial deviation without modifying data", () => {
 const input = { ...scope, theoreticalMilli: 10000, countedMilli: 9000, bookValueMinor: 20000 };
 const x = blindCountVariance(input);
 assert.equal(x.differenceMilli, -1000);
 assert.equal(x.deviationPercent, -10);
 assert.equal(x.financialDifferenceMinor, -2000);
 assert.equal(input.theoreticalMilli, 10000);
});
test("zero theoretical stock cannot invent a financial valuation", () => {
 const x = blindCountVariance({ ...scope, theoreticalMilli: 0, countedMilli: 1000, bookValueMinor: 0 });
 assert.equal(x.deviationPercent, null);
 assert.equal(x.financialDifferenceMinor, null);
});
test("reject invalid scope, negative counts, fractional units and invalid days", () => {
 assert.throws(() => reorderRecommendation({ ...scope, onHandMilli: -1, dailyUsageMilli: 1, leadDays: 1 }));
 assert.throws(() => reorderRecommendation({ ...scope, onHandMilli: 1, dailyUsageMilli: 1, leadDays: 0.5 }));
 assert.throws(() => blindCountVariance({ ...scope, theoreticalMilli: 1.5, countedMilli: 0, bookValueMinor: 0 }));
 assert.throws(() => blindCountVariance({ ...scope, theoreticalMilli: 0, countedMilli: 0, bookValueMinor: 1 }));
});
