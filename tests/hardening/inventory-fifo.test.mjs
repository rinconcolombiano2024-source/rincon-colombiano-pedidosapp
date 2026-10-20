import test from "node:test";
import assert from "node:assert/strict";
import {purchaseConversion,fifoIssue,physicalCount,reorderAlert,wasteRecord} from "../../inventory/fifo.mjs";
const base={restaurantId:"r1",warehouseId:"fridge",ingredientId:"beef"};
const lots=[{...base,lotId:"old",receivedAt:"2026-10-01T09:00:00Z",originalMilli:1000,availableMilli:1000,totalCostMinor:1000},{...base,lotId:"new",receivedAt:"2026-10-02T09:00:00Z",originalMilli:2000,availableMilli:2000,totalCostMinor:4000}];
test("FIFO consumes oldest warehouse lot first and values in minor units",()=>{const a=fifoIssue({...base,lots:lots.slice().reverse(),quantity:1.5});assert.deepEqual(a.allocations.map(x=>x.lotId),["old","new"]);assert.equal(a.totalCostMinor,2000)});
test("FIFO blocks overselling and cross restaurant/warehouse access",()=>{assert.throws(()=>fifoIssue({...base,lots,quantity:4}),/INSUFFICIENT/);assert.throws(()=>fifoIssue({...base,warehouseId:"bar",lots,quantity:1}),/SCOPE_MISMATCH/)});
test("FIFO partial issue cost rounding is stable across sequential draws",()=>{const l={...lots[0],originalMilli:3,availableMilli:3,totalCostMinor:1};const a=fifoIssue({...base,lots:[l],quantity:0.001});const b=fifoIssue({...base,lots:[{...l,availableMilli:2}],quantity:0.002});assert.equal(a.totalCostMinor+b.totalCostMinor,1)});
test("unit conversion is integer precise and fails closed",()=>{assert.equal(purchaseConversion({packs:2,factorBaseMilli:25000000}),50000000);assert.throws(()=>purchaseConversion({packs:1.5,factorBaseMilli:1000}));assert.throws(()=>purchaseConversion({packs:2,factorBaseMilli:0}))});
test("blind count reports stock and financial variance, without mutating stock",()=>{const a=physicalCount({theoreticalMilli:10000,countedMilli:9000,bookValueMinor:20000});assert.equal(a.differenceMilli,-1000);assert.equal(a.deviationPercent,-10);assert.equal(a.valueDifferenceMinor,-2000);assert.equal(a.requiresApproval,true)});
test("reorder uses daily demand and lead time",()=>{assert.deepEqual(reorderAlert({onHandMilli:4000,averageDailyMilli:2000,leadDays:2,safetyMilli:1000}),{reorderPointMilli:5000,reorder:true,suggestedPurchaseMilli:3000})});
test("waste categories reject unknown reasons",()=>{assert.equal(wasteRecord({reason:"rotura",quantity:0.5}).milli,500);assert.throws(()=>wasteRecord({reason:"sale",quantity:1}))});

test("FIFO orders by absolute receipt instant, not timezone text",()=>{
 const newer={...lots[0],lotId:"newer",receivedAt:"2026-10-01T10:00:00+02:00"};
 const older={...lots[1],lotId:"older",receivedAt:"2026-10-01T07:30:00Z"};
 const result=fifoIssue({...base,lots:[newer,older],quantity:1});
 assert.deepEqual(result.allocations.map(x=>x.lotId),["older"]);
});
