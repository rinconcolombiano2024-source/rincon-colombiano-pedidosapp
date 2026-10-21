import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync("app.js","utf8");
const www=readFileSync("www/app.js","utf8");
const html=readFileSync("restaurante.html","utf8");
const save=app.match(/async function saveCloudMenuRequest\(\) \{[\s\S]*?\n\}\n\nasync function saveRestaurantPublicProfile/);
test("menu cloud save uses revision control and server read-back verification",()=>{
 assert.ok(save,"cloud save exists");
 assert.match(save[0],/p_expected_revision: storedCloudRevision/);
 assert.match(save[0],/confirmSavedCloudMenu\(confirmed, null, submittedMenu\)/);
 assert.match(save[0],/mergeConcurrentMenuChanges\(baseMenu, nextMenu, remoteMenu\)/);
 assert.match(save[0],/assertMenuOwnerSession\(\)/);
});
test("all language description fields are normalized without truncation",()=>{
 const fn=app.match(/function normalizeProductDescription\(value\) \{[\s\S]*?\n\}/)?.[0];
 assert.ok(fn);
 assert.doesNotMatch(fn,/slice\s*\(|substring\s*\(|substr\s*\(/);
 const saveProduct=app.match(/async function saveProduct\(\) \{[\s\S]*?\n\}\n/)?.[0];
 assert.ok(saveProduct);
 for(const id of ["productDescriptionInput","productDescriptionPlInput","productDescriptionEnInput"]){
  assert.match(saveProduct,new RegExp("normalizeProductDescription\\(elements\\."+id+"\\.value\\)"));
  const tag=html.match(new RegExp("<textarea\\s+[^>]*id=\\\""+id+"\\\"[^>]*>","i"));
  assert.ok(tag,id);assert.doesNotMatch(tag[0],/maxlength\s*=/i);
 }
 assert.equal(www,app,"published www app source matches root");
});
