import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const paths = ["app.js", "www/app.js"];
const longText = ("Sancocho de bagre con ingredientes tradicionales.\n" +
  "Sin cebolla; salsa aparte; conservar la receta.\n").repeat(300);

for (const path of paths) {
  test(`${path}: full multilingual descriptions survive normalization without truncation`, () => {
    const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    const start = source.indexOf("function normalizeProductDescription(value)");
    const end = source.indexOf("\nfunction hashText(", start);
    assert.ok(start >= 0 && end > start, "description normalizer must exist");
    const normalize = vm.runInNewContext(source.slice(start, end) + "\nnormalizeProductDescription");
    assert.equal(normalize(longText), longText.trim());
    assert.equal(normalize(longText.replace(/\n/g, "\r\n")), longText.trim());

    const saveStart = source.indexOf("async function saveProduct()");
    const saveEnd = source.indexOf("\nfunction editProduct(", saveStart);
    assert.ok(saveStart >= 0 && saveEnd > saveStart, "product editor save path must exist");
    const save = source.slice(saveStart, saveEnd);
    for (const field of ["productDescriptionInput", "productDescriptionPlInput", "productDescriptionEnInput"]) {
      assert.match(save, new RegExp("normalizeProductDescription\\(elements\\." + field + "\\.value\\)"));
    }
    assert.match(save, /await saveMenuCatalog\(\)/);
    assert.match(save, /menuCatalog = menuBeforeSave/);
    assert.match(save, /translations\.es = \{ name, description \}/);
    assert.match(save, /translations\.pl = \{ name: namePl, description: descriptionPl \}/);
    assert.match(save, /translations\.en = \{ name: nameEn, description: descriptionEn \}/);
  });
}
