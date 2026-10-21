import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("supabase/functions/delivery-quote/index.ts","utf8");
test("Google Maps configuration failures are not blamed on customer addresses",()=>{
 assert.match(source,/\["REQUEST_DENIED", "OVER_DAILY_LIMIT", "OVER_QUERY_LIMIT"\]/);
 assert.match(source,/googleConfigFailure \? 503 : 422/);
 assert.match(source,/provider: "google_geocoding"/);
 assert.match(source,/providerStatus:/);
 assert.match(source,/if \(distanceMeters < 100 \|\| distanceMeters > 200000\)/);
});
