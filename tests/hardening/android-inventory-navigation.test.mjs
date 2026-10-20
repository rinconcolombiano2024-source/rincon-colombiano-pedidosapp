import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("Inventory opens in the same Capacitor WebView with browser back navigation",()=>{
 for(const file of ["restaurante.html","www/restaurante.html"]){
  const html=readFileSync(file,"utf8");
  const anchor=html.match(/<a\b[^>]*href="\.\/inventario\.html"[^>]*>/);
  assert.ok(anchor,"Inventory link missing: "+file);
  assert.doesNotMatch(anchor[0],/target="_blank"/i,"Native WebView popup can close the app");
 }
 assert.equal(readFileSync("restaurante.html","utf8"),readFileSync("www/restaurante.html","utf8"));
});
