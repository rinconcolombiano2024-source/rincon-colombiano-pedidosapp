"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

for (const file of ["cliente.js", "www/cliente.js"]) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  test(file + ": special instructions cannot escape HTML attributes", () => {
    const start = source.indexOf("function customerEscapeHtml(value) {");
    const end = source.indexOf("function customerCleanCategoryName(", start);
    assert.ok(start >= 0 && end > start, "HTML escaping function must exist");
    const ctx = vm.createContext({});
    vm.runInContext(source.slice(start, end), ctx);
    const attack = '" autofocus onfocus="alert(1)<script>&\'';
    const escaped = ctx.customerEscapeHtml(attack);
    assert.equal(escaped, "&quot; autofocus onfocus=&quot;alert(1)&lt;script&gt;&amp;&#039;");
    assert.equal(escaped.includes("<script>"), false);
    assert.equal(escaped.includes('"'), false);
    const render = source.slice(source.indexOf("function customerRenderCart() {"));
    assert.match(render, /value="\$\{customerEscapeHtml\([\s\S]*?item\.note/);
    assert.match(render, /data-id="\$\{customerEscapeHtml\(item\.id\)\}"/);
  });
  test(file + ": editing an item note normalizes input without changing its price", () => {
    assert.match(source, /item\.note = customerNormalizeNoteDraft\(event\.target\.value\)/);
    assert.match(source, /maxlength="250"[^>]*data-action="note"/);
    assert.match(source, /customerCart = customerCart\.map\(\(item\) => \{[\s\S]*?\.\.\.item,/);
  });
}
