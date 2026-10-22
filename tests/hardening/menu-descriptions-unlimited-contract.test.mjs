import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../../",import.meta.url);
const fields=["productDescriptionInput","productDescriptionPlInput","productDescriptionEnInput"];
for(const file of ["restaurante.html","www/restaurante.html"]){
  test(`${file}: all three descriptions are multiline and have no HTML character cap`,()=>{
    const html=readFileSync(new URL(file,root),"utf8");
    for(const id of fields){
      const match=html.match(new RegExp("<textarea\\b([^>]*)>","gi"))?.find(tag=>tag.includes(`id="${id}"`));
      assert.ok(match,`Missing textarea ${id}`);
      assert.doesNotMatch(match,/\bmaxlength\s*=/i,`Unexpected length limit on ${id}`);
      assert.doesNotMatch(match,/\breadonly\b|\bdisabled\b/i);
    }
  });
}
test("restaurant cloud save checks confirmed menu and avoids overwriting in-flight edits",()=>{
 const js=readFileSync(new URL("app.js",root),"utf8");
 assert.match(js,/MENU_SAVE_CONTENT_MISMATCH/);
 assert.match(js,/menuCatalogsMatch\(menuCatalog, submitted\)/);
 assert.match(js,/saveCloudMenuRequest/);
 for(const id of fields)assert.ok(js.includes(id));
});
