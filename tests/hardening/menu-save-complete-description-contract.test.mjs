import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const rawApp=readFileSync("app.js","utf8");
const app=rawApp.replace(/\r\n/g,"\n");
const www=readFileSync("www/app.js","utf8");
const html=readFileSync("restaurante.html","utf8");
const saveStart=app.indexOf("async function saveCloudMenuRequest() {");
const saveEnd=app.indexOf("async function saveRestaurantPublicProfile()",saveStart);
const save=saveStart>=0 && saveEnd>saveStart ? app.slice(saveStart,saveEnd) : null;
test("menu cloud save uses revision control and server read-back verification",()=>{
 assert.ok(save,"cloud save exists");
 assert.match(save,/p_expected_revision: storedCloudRevision/);
 assert.match(save,/confirmSavedCloudMenu\(confirmed, null, submittedMenu\)/);
 assert.match(save,/mergeConcurrentMenuChanges\(baseMenu, nextMenu, remoteMenu\)/);
 assert.match(save,/assertMenuOwnerSession\(\)/);
});
test("all language description fields are normalized without truncation",()=>{
 const fn=app.match(/function normalizeProductDescription\(value\) \{[\s\S]*?\n\}/)?.[0];
 assert.ok(fn);
 assert.doesNotMatch(fn,/slice\s*\(|substring\s*\(|substr\s*\(/);
 const productStart=app.indexOf("async function saveProduct() {");
 const productEnd=app.indexOf("  let imageUrl = normalizeProductImageUrl",productStart);
 const saveProduct=productStart>=0 && productEnd>productStart ? app.slice(productStart,productEnd) : null;
 assert.ok(saveProduct);
 for(const id of ["productDescriptionInput","productDescriptionPlInput","productDescriptionEnInput"]){
  assert.match(saveProduct,new RegExp("normalizeProductDescription\\(elements\\."+id+"\\.value\\)"));
  const tag=html.match(new RegExp("<textarea\\s+[^>]*id=\\\""+id+"\\\"[^>]*>","i"));
  assert.ok(tag,id);assert.doesNotMatch(tag[0],/maxlength\s*=/i);
 }
 assert.equal(www,rawApp,"published www app source matches root");
});
