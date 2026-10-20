import test from "node:test";
import assert from "node:assert/strict";
import { calculateStockPreview } from "../../inventory/preview.mjs";
test("zero stock is unavailable, not merely low",()=>{
 const result=calculateStockPreview({quantity:0,minimum:0,price:5});
 assert.deepEqual(result,{status:"out",valueMinor:0});
});
test("threshold equality is low",()=>{
 assert.equal(calculateStockPreview({quantity:2,minimum:2,price:5}).status,"low");
 assert.equal(calculateStockPreview({quantity:3,minimum:2,price:5}).status,"ok");
});
test("invalid precision, ranges, and values fail closed",()=>{
 for(const quantity of [-1,1.0001,1e12,NaN,Infinity,"1"]){
  assert.throws(()=>calculateStockPreview({quantity,minimum:0,price:5}),/INVALID_STOCK_PREVIEW/);
 }
 for(const price of [-1,1.001,1e12,NaN,Infinity,"1"]){
  assert.throws(()=>calculateStockPreview({quantity:1,minimum:0,price}),/INVALID_STOCK_PREVIEW/);
 }
});
test("value is returned in integer minor units",()=>{
 assert.equal(calculateStockPreview({quantity:1.5,minimum:0,price:2.50}).valueMinor,375);
});
