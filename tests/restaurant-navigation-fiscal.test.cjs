const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("QR, stations and kitchen open natively in new, isolated tabs", () => {
  for (const prefix of ["", "www/"]) {
    const html = read(prefix + "restaurante.html");
    const js = read(prefix + "app.js");
    for (const id of ["openClientPageButton", "openWaiterLinkButton", "restaurantKitchenLink"]) {
      assert.match(html, new RegExp('id="' + id + '"[^>]*target="_blank"[^>]*rel="noopener noreferrer"'));
    }
    assert.match(js, /elements\.openClientPageButton\.setAttribute\("href", link\)/);
    assert.match(js, /elements\.openWaiterLinkButton\.setAttribute\("href", elements\.waiterLinkInput\.value\)/);
    assert.match(js, /event\.currentTarget\.href = url\.toString\(\)/);
    assert.doesNotMatch(js, /addEventListener\("click", openClientPage\)/);
    assert.doesNotMatch(js, /addEventListener\("click", openWaiterLink\)/);
    assert.match(html, /id="openFiscalPrinterTopButton"/);
    assert.match(html, /id="connectFiscalPrinterButton"/);
    assert.match(html, /restaurant-fiscal-ui\.js\?v=91\.0\.4-nav1/);
    new vm.Script(js, { filename: prefix + "app.js" });
  }
});

test("public application mirrors source and fiscal setup never simulates printing", () => {
  for (const p of ["app.js","restaurante.html","styles.css","restaurant-fiscal-ui.js"]) {
    assert.equal(read(p), read("www/" + p), p + " must match published copy");
  }
  const ui = read("restaurant-fiscal-ui.js");
  for (const locale of ["es", "pl", "en"]) assert.match(ui, new RegExp("^\\s*" + locale + ":", "m"));
  assert.match(ui, /navigator\.serial\.requestPort\(\)/);
  assert.match(ui, /navigator\.serial\.getPorts\(\)/);
  assert.doesNotMatch(ui, /\bport\.open\s*\(/);
  assert.doesNotMatch(ui, /\bport\.write\s*\(/);
  assert.doesNotMatch(ui, /setInterval\s*\(/);
  new vm.Script(ui, { filename: "restaurant-fiscal-ui.js" });
});
