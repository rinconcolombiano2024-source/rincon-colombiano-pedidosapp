import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source=readFileSync("cliente.js","utf8");
const start=source.indexOf("   const verifiedLat =");
const end=source.indexOf("if (hasVerifiedCoords)",start);
assert.ok(start>=0&&end>start);
const expression=source.slice(start,end).replaceAll("const ","var ");
function verified(data){const ctx=vm.createContext({data});vm.runInContext(expression+"\nthis.result=hasVerifiedCoords;",ctx);return ctx.result;}
test("missing or empty coordinates must not be accepted as GPS 0,0",()=>{
 for(const data of [{},{verifiedLat:null,verifiedLng:null},{verifiedLat:"",verifiedLng:""},{verifiedLat:52.2,verifiedLng:null}])assert.equal(verified(data),false);
});
test("real Google Maps coordinates remain accepted",()=>{
 assert.equal(verified({verifiedLat:52.2297,verifiedLng:21.0122}),true);
 assert.equal(verified({verifiedLat:0,verifiedLng:0}),true);
 assert.equal(verified({verifiedLat:91,verifiedLng:21}),false);
});
