"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// Test the actual category-selection statement from the customer menu loader.
for (const path of ["cliente.js", "www/cliente.js"]) {
  test(path + " keeps the selected category when a live menu update arrives", () => {
    const source = fs.readFileSync(path, "utf8");
    const start = source.indexOf("  // Preserve the browsing position when Realtime updates a menu.");
    const end = source.indexOf("  customerSyncCartWithCurrentMenu();", start);
    assert.ok(start > 0 && end > start, "category refresh protection exists");
    const selection = source.slice(start, end);
    const run = (categories, active) => {
      const context = vm.createContext({
        customerMenu: Object.fromEntries(categories.map(name => [name, []])),
        customerActiveCategory: active,
      });
      vm.runInContext(selection, context, { filename: path });
      return context.customerActiveCategory;
    };
    assert.equal(run(["Platos", "Bebidas"], "Bebidas"), "Bebidas", "selected category survives updates");
    assert.equal(run(["Platos", "Postres"], "Bebidas"), "Platos", "removed category uses first available category");
    assert.equal(run(["Platos", "Postres"], "Postres"), "Postres", "valid active category is unchanged");
    assert.equal(run([], "Platos"), "", "empty menus are handled");
  });
}
