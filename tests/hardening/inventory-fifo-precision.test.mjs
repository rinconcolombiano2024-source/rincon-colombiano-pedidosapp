import test from "node:test";
import assert from "node:assert/strict";
import { fifoIssue } from "../../inventory/fifo.mjs";
const scope={restaurantId:"r1",warehouseId:"w1",ingredientId:"i1"};
test("FIFO uses exact integer rounding for large safe amounts",()=>{
 const lot={...scope,lotId:"lot1",receivedAt:"2026-10-20T12:00:00Z",originalMilli:9007199254740991,availableMilli:9007199254740991,totalCostMinor:9007199254740991};
 const result=fifoIssue({...scope,lots:[lot],quantity:1});
 assert.equal(result.totalCostMinor,1000);
});
test("FIFO preserves restaurant isolation",()=>{
 const lot={...scope,restaurantId:"other",lotId:"lot1",receivedAt:"2026-10-20T12:00:00Z",originalMilli:1000,availableMilli:1000,totalCostMinor:100};
 assert.throws(()=>fifoIssue({...scope,lots:[lot],quantity:1}),/SCOPE_MISMATCH/);
});
