import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("supabase/functions/delivery-quote/index.ts", "utf8");
test("delivery quote rejects incomplete or invalid GPS pairs before geocoding", () => {
  assert.match(source, /hasDestinationLat !== hasDestinationLng/);
  assert.match(source, /destinationLat === null \|\| destinationLng === null/);
  assert.ok(source.indexOf("Both valid GPS coordinates are required") < source.indexOf("const geocodeParams"));
});
test("delivery quote calculates road distance on server and persists authoritative fee", () => {
  assert.match(source, /routes\.googleapis\.com\/directions\/v2:computeRoutes/);
  assert.match(source, /rc_ordera_create_delivery_quote/);
  assert.match(source, /finalFee: Number\(quote\.final_fee\)/);
});
