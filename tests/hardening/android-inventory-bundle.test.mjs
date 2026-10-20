import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
test("Capacitor bundles the inventory page, JS, and its imported preview module",()=>{
 const build=readFileSync("scripts/prepare-capacitor.mjs","utf8");
 for(const name of ["inventario.html","inventario.js","inventory/preview.mjs"]){
  assert.ok(build.includes('"'+name+'"'),"missing "+name+" from Android assets");
  assert.equal(readFileSync(name,"utf8"),readFileSync("www/"+name,"utf8"),"Android copy differs: "+name);
 }
 assert.match(readFileSync("www/restaurante.html","utf8"),/inventario\.html/);
});