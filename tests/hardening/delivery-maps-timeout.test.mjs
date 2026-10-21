import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("supabase/functions/delivery-quote/index.ts","utf8");
test("geocoding and driving routes have bounded request times",()=>{
 assert.equal((source.match(/AbortSignal\.timeout\(8000\)/g)||[]).length,2);
});
test("provider transport failures return retryable errors without creating a quote",()=>{
 for(const message of ["Google Maps geocoding is temporarily unavailable","Google Maps routing is temporarily unavailable"]){
  assert.ok(source.includes(message));
  assert.ok(source.indexOf(message)<source.indexOf('admin.rpc("rc_ordera_create_delivery_quote"'));
 }
});
