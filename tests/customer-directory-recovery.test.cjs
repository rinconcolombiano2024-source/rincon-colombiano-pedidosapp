"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const original = fs.readFileSync(path.join(root, "cliente.js"), "utf8");
const served = fs.readFileSync(path.join(root, "www/cliente.js"), "utf8");
assert.equal(original, served, "The production www script must exactly mirror its source.");
const start = original.indexOf("function customerDirectoryScopeKey()");
const end = original.indexOf("async function customerSelectRestaurant(", start);
assert.ok(start > 0 && end > start, "Directory loader must be present.");
const snippet = original.slice(start, end);

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function makeHarness(options = {}) {
  const calls = [], rendered = [], timeouts = new Map();
  let nextTimer = 1;
  let currentScope = { countryCode: "PL", city: "Warszawa", region: "Mazowieckie" };
  const client = {
    rpc: (name, params) => {
      calls.push([name, { ...params }]);
      return options.rpc ? options.rpc(name, params) : Promise.resolve({
        data: [{ userId: "rc-1", name: "Rincon", countryCode: "PL", region: "Mazowieckie" }],
        error: null,
      });
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({ ilike: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
            order: () => Promise.resolve({ data: [], error: null }) }),
        }),
      }),
    }),
  };
  const list = { innerHTML: "" };
  const ctx = vm.createContext({
    customerDirectoryLoadPromise: null,
    customerDirectoryLoadScope: "",
    customerRegistrationRegion: currentScope,
    customerClient: client,
    customerEnsureClient: () => client,
    customerElements: { restaurantList: list },
    customerT: (key) => key,
    customerEscapeHtml: (text) => text,
    customerStartDirectoryRealtime: () => {
      if (options.realtimeThrows) throw new Error("WebSocket unavailable");
    },
    customerIsMissingRpc: (error) => error?.code === "PGRST202",
    customerNormalizeRestaurantProfile: (item) => item,
    customerNormalizeSearchText: (value) => String(value || "").toLowerCase(),
    customerDeduplicateRestaurants: (items) => items,
    customerSelectedRestaurant: () => null,
    customerRenderRestaurantDirectory: () => { rendered.push(Array.from(ctx.customerRestaurants, (r) => r.userId)); },
    customerClearRestaurantSelection: () => { throw new Error("Stale directory may not clear selection"); },
    customerRestaurants: [],
    customerStoreId: "",
    console: { warn: () => {} },
    setTimeout: (callback, delay) => {
      const id = nextTimer++;
      timeouts.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => { timeouts.delete(id); },
  });
  vm.runInContext(snippet, ctx, { filename: "cliente.js:directory" });
  return {
    ctx, client, calls, list, rendered, timeouts,
    region: (region) => { currentScope = { ...currentScope, region }; ctx.customerRegistrationRegion = currentScope; },
    expire: () => {
      const entry = Array.from(timeouts.values()).find((x) => x.delay === 12000);
      assert.ok(entry, "A twelve-second watchdog must have been registered");
      entry.callback();
    },
  };
}

test("healthy Polish directory is rendered without duplicate RPC requests", async () => {
  const h = makeHarness();
  assert.equal(await h.ctx.customerLoadRestaurantDirectory(), true);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.rendered, [["rc-1"]]);
  assert.equal(h.timeouts.size, 0, "watchdog timer must be cleaned");
});

test("stalled Supabase directory finishes with an error rather than infinite loading", async () => {
  const h = makeHarness({ rpc: () => new Promise(() => {}) });
  const operation = h.ctx.customerLoadRestaurantDirectory();
  h.expire();
  assert.equal(await operation, false);
  assert.match(h.list.innerHTML, /restaurantLoadError/);
  assert.equal(h.timeouts.size, 0);
  assert.equal(h.calls.length, 1, "Never silently retry a failing RPC");
});

test("regional change queues a fresh read and cannot publish stale restaurants", async () => {
  const old = deferred();
  const h = makeHarness({ rpc: (_name, params) =>
    params.p_region === "Mazowieckie"
      ? old.promise
      : Promise.resolve({ data: [{ userId: "new-1", name: "New", countryCode: "PL", region: "Malopolskie" }], error: null }) });
  const first = h.ctx.customerLoadRestaurantDirectory();
  await Promise.resolve();
  h.region("Malopolskie");
  const second = h.ctx.customerLoadRestaurantDirectory();
  old.resolve({ data: [{ userId: "old-1", name: "Old", countryCode: "PL", region: "Mazowieckie" }], error: null });
  await first;
  assert.equal(h.rendered.length, 0, "Old response must not be rendered");
  assert.equal(await second, true);
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.rendered, [["new-1"]]);
});

test("realtime subscription failure does not hide a healthy public catalog", async () => {
  const h = makeHarness({ realtimeThrows: true });
  assert.equal(await h.ctx.customerLoadRestaurantDirectory(), true);
  assert.deepEqual(h.rendered, [["rc-1"]]);
});

test("a thrown public directory transport error visibly settles the request", async () => {
  const h = makeHarness({ rpc: () => { throw new Error("Network down"); } });
  assert.equal(await h.ctx.customerLoadRestaurantDirectory(), false);
  assert.match(h.list.innerHTML, /restaurantLoadError/);
  assert.equal(h.timeouts.size, 0);
});
