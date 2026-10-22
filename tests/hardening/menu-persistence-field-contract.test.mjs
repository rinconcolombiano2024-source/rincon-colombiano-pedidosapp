import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../../",import.meta.url);
const fields=["productDescriptionInput","productDescriptionPlInput","productDescriptionEnInput"];
for(const file of ["restaurante.html","www/restaurante.html"]){
 test(`${file}: menu description inputs stay editable without maxlength`,()=>{
  const html=readFileSync(new URL(file,root),"utf8");
  for(const id of fields){
   const tag=html.match(/<textarea\\b[^>]*>/gi)?.find(x=>x.includes(`id="${id}"`));
   assert.ok(tag,`Missing ${id}`);
   assert.doesNotMatch(tag,/\\bmaxlength\\s*=/i);
  }
 });
}
test("cloud menu save has content confirmation and concurrent-edit protection",()=>{
 const app=readFileSync(new URL("app.js",root),"utf8");
 assert.match(app,/MENU_SAVE_CONTENT_MISMATCH/);
 assert.match(app,/menuCatalogsMatch\\(menuCatalog, submitted\\)/);
 assert.match(app,/saveCloudMenuRequest/);
});
