import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const source=readFileSync("app.js","utf8");
const match=source.match(/function normalizeProductDescription\(value\) \{[\s\S]*?\n\}/);
assert.ok(match,"menu description normalizer exists");
const normalize=vm.runInNewContext(match[0]+"\nnormalizeProductDescription");
test("menu descriptions are not silently truncated beyond 260 characters",()=>{const input="Descripción extensa ".repeat(120);assert.equal(normalize(input),input.trim());});
test("menu description retains unicode and punctuation in ES PL EN",()=>{for(const text of ["Café con ñ y á. ".repeat(40),"Żurek, łosoś i śmietana. ".repeat(40),"Tender beef & sauce. ".repeat(40)])assert.equal(normalize(text),text.trim());});
test("menu description inputs have no HTML maxlength",()=>{const html=readFileSync("restaurante.html","utf8");for(const id of ["productDescriptionInput","productDescriptionPlInput","productDescriptionEnInput"]){const tag=html.match(new RegExp("<textarea\\s+[^>]*id=\\\""+id+"\\\"[^>]*>","i"));assert.ok(tag,id);assert.doesNotMatch(tag[0],/maxlength\s*=/i);}});


test("menu editor preserves multiline text and significant inner spacing",()=>{
  const text="Ingredientes:\n  Camarones, arroz y carne.\n\nPreparación:\nServir caliente.  Sin picante.";
  assert.equal(normalize(text),text);
  assert.equal(normalize("  "+text+"  "),text);
  assert.equal(normalize("Primera línea\r\nSegunda línea\rTercera línea"),"Primera línea\nSegunda línea\nTercera línea");
});
test("descriptions can exceed 10,000 Unicode characters without truncation in ES PL EN",()=>{
  for(const text of ["Ingredientes del sancocho 🍲\n","Składniki dania: żółty ser 🧀\n","Fresh seafood ingredients 🦐\n"]){
    const long=text.repeat(500);
    assert.ok(long.length>10000);
    assert.equal(normalize(long),long.trim());
  }
});
test("cloud and editor use the same lossless description normalizer in both distributions",()=>{
  const root=readFileSync("app.js","utf8");
  const android=readFileSync("www/app.js","utf8");
  assert.equal(root,android);
  assert.match(root,/const description = normalizeProductDescription\(elements\.productDescriptionInput\.value\)/);
  assert.match(root,/normalizeProductDescription\(elements\.productDescriptionPlInput\.value\)/);
  assert.match(root,/normalizeProductDescription\(elements\.productDescriptionEnInput\.value\)/);
  assert.match(root,/p_menu:\s*nextMenu/);
  assert.match(root,/await verifyPublicMenuProjection\(confirmedMenu, revision\)/);
});
