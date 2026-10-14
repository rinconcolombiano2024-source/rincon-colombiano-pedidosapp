"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function harness(file, rpcResult, active = true) {
  const source = fs.readFileSync(file, "utf8");
  const requests = [], filters = [];
  const menu = { menu: { Platos: [{ id: "dish", description: "Descripción conservada" }] }, settings: {} };
  const c = vm.createContext({
    customerMenuFetchPromise: null, customerMenuFetchStoreId: "",
    customerClient: {
      async rpc(name, params) { requests.push({ rpc: name, params }); return await rpcResult; },
      from(table) {
        requests.push({ table });
        return {
          select() { return this; },
          eq(key, value) { filters.push([table, key, value]); return this; },
          is(key, value) { filters.push([table, key, value]); return this; },
          async maybeSingle() {
            return { data: table === "restaurant_profiles" ? (active ? { user_id: "restaurant" } : null) : menu, error: null };
          },
        };
      },
    },
  });
  const extract = (start, end) => {
    const a = source.indexOf(start), b = source.indexOf(end, a);
    assert.ok(a > 0 && b > a);
    return source.slice(a, b);
  };
  vm.runInContext([
    extract("function customerIsMissingRpc(error)", "function customerStopDirectoryRealtime()"),
    extract("function customerFetchPublicMenu(storeId)", "function customerMenuCacheKey(storeId)"),
    extract("async function customerFetchPublicMenuNow(storeId)", "function customerStopMenuRealtime()"),
  ].join("\n"), c, { filename: file });
  return { c, requests, filters, menu };
}

for (const file of ["cliente.js", "www/cliente.js"]) {
  test(`${file}: failed menu RPC never amplifies overload or permission errors into table reads`, async () => {
    for (const error of [{ status: 429 }, { status: 503 }, { code: "PGRST002" }, { code: "PGRST003" }, { code: "42501" }]) {
      const h = harness(file, { data: null, error });
      await assert.rejects(h.c.customerFetchPublicMenu("restaurant"), reason => reason === error);
      assert.equal(h.requests.length, 1, JSON.stringify(error));
      assert.equal(h.c.customerMenuFetchPromise, null, "a later user retry remains available");
    }
  });

  test(`${file}: legacy missing RPC retains active-profile and tenant-scoped public menu fallback`, async () => {
    for (const code of ["PGRST202", "42883"]) {
      const h = harness(file, { data: null, error: { code } });
      assert.equal(await h.c.customerFetchPublicMenu("restaurant"), h.menu);
      assert.equal(h.requests.length, 3);
      assert.deepEqual(h.filters, [
        ["restaurant_profiles", "user_id", "restaurant"],
        ["restaurant_profiles", "active", true],
        ["restaurant_profiles", "deleted_at", null],
        ["restaurant_public_catalogs", "restaurant_user_id", "restaurant"],
      ]);
    }
  });

  test(`${file}: inactive restaurant cannot use legacy public catalog fallback`, async () => {
    const h = harness(file, { data: null, error: { code: "PGRST202" } }, false);
    assert.equal(await h.c.customerFetchPublicMenu("restaurant"), null);
    assert.equal(h.requests.length, 2);
  });

  test(`${file}: 20 simultaneous menu readers still share one successful RPC`, async () => {
    let finish;
    const h = harness(file, new Promise(resolve => { finish = resolve; }));
    const calls = Array.from({ length: 20 }, () => h.c.customerFetchPublicMenu("restaurant"));
    assert.equal(h.requests.length, 1);
    finish({ data: [h.menu], error: null });
    const results = await Promise.all(calls);
    assert.ok(results.every(value => value === h.menu));
    assert.equal(h.requests.length, 1);
  });

  test(`${file}: valid empty RPC preserves the existing legacy lookup`, async () => {
    const h = harness(file, { data: [], error: null });
    assert.equal(await h.c.customerFetchPublicMenu("restaurant"), h.menu);
    assert.equal(h.requests.length, 3);
  });
}
