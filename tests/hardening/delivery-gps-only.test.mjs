import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source=readFileSync("supabase/functions/delivery-quote/index.ts","utf8");
const start=source.indexOf("  if (!/^[0-9a-f-]{36}$/i.test(restaurantUserId)");
const end=source.indexOf("\n  const admin =",start);
assert.ok(start>=0&&end>start);
const expression=source.slice(start,end).replace(/return response\(400,\s*\{\s*error:\s*"Restaurant, address, and country are required"\s*\}\);/,'throw new Error("INVALID");');
const restaurantUserId="123e4567-e89b-12d3-a456-426614174000";
function accepts(destinationAddress,destinationLat,destinationLng,countryCode="PL"){
 const ctx=vm.createContext({restaurantUserId,destinationAddress,destinationLat,destinationLng,countryCode});
 try{vm.runInContext(expression,ctx);return true;}catch(e){if(e.message==="INVALID")return false;throw e;}
}
test("GPS-only destination is accepted for reverse geocoding",()=>assert.equal(accepts("",52.2297,21.0122),true));
test("typed address without GPS remains accepted",()=>assert.equal(accepts("Warszawa, Czapelska 33",null,null),true));
test("missing address and GPS is rejected",()=>assert.equal(accepts("",null,null),false));
test("invalid country is rejected even with GPS",()=>assert.equal(accepts("",52.2,21.0,"US"),false));
