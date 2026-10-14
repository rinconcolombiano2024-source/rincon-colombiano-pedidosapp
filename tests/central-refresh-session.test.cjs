"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function harness(file) {
  const source = fs.readFileSync(file, "utf8");
  const writes = [], reads = [], pending = [];
  const client = { from(table) {
    const query = {
      select() { return this; },
      eq(column, value) { reads.push({ table, column, value }); return this; },
      order() { return this; },
      maybeSingle() { return new Promise(resolve => pending.push({ table, resolve })); },
      limit() { return this.maybeSingle(); },
    };
    return query;
  }};
  const record = name => (...args) => writes.push({ name, args });
  const c = vm.createContext({
    console: { error: record("error"), warn() {} },
    navigator: { onLine: true },
    cloudState: { client, user: { id: "restaurant-a" } },
    centralRefreshLastStartedAt: 0, centralRefreshRetryNotBefore: 0,
    CENTRAL_REFRESH_MIN_INTERVAL_MS: 5000,
    centralSyncInProgress: false, centralSyncRefreshPending: false,
    centralSyncRequestedScopes: { settings: false, profile: false, orders: false },
    LOCAL_ORDER_CACHE_LIMIT: 500,
    STORAGE_KEYS: { settingsRevision: "settings-revision", menuRevision: "menu-revision", restaurantActive: "active" },
    withCloudTimeout: request => Promise.resolve(request),
    scheduleCentralRefresh: record("schedule"),
    deferCentralRefreshAfterError: record("retry"),
    isTemporarySyncInfrastructureError: () => false,
    hasPendingSettings: () => false, hasPendingMenu: () => false,
    storeCloudRevision: record("revision"),
    applySettingsPayload: record("settings"), storeConfirmedCloudSettings: record("confirmed-settings"),
    normalizeMenuCatalog: value => value,
    menuCatalogsMatch: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    menuCatalog: { local: [{ id: "local-dish" }] },
    saveMenuCache: record("menu-cache"), storeConfirmedCloudMenu: record("confirmed-menu"),
    renderCategories: record("categories"), renderMenu: record("menu"), renderMenuEditor: record("editor"),
    elements: {}, applyPublicRestaurantProfileFallback: record("profile"),
    localStorage: { setItem: record("storage") }, restaurantActive: true,
    readDeletedOrderIds: () => [], needsCloudSync: order => order.syncStatus === "pending",
    savedOrders: [{ id: "local-order", syncStatus: "pending" }],
    normalizeOrderType: value => value, orderBusinessDate: () => "2026-10-14",
    mergeOrders: (remote, local) => [...remote, ...local], saveOrders: record("orders"),
    renderCurrencySettings: record("currency"), renderRestaurantStatus: record("restaurant"),
    updateRestaurantStatusSync: record("status-sync"), renderHistory: record("history"),
    updateCloudStatus: record("cloud-status"),
  });
  const start = source.indexOf("async function refreshCentralCloudState(options = {}) {");
  const end = source.indexOf("function scheduleCentralRealtimeReconnect()", start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(source.slice(start, end), c, { filename: file });
  const finish = () => {
    for (const { table, resolve } of pending.splice(0)) {
      const data = table === "app_settings"
        ? { menu: { remote: [{ id: "remote-dish" }] }, settings: { businessName: "Old restaurant" }, menu_revision: 7, settings_revision: 8 }
        : table === "restaurant_profiles" ? { active: true }
        : [{ order_json: { id: "remote-order", type: "local" }, revision: 3 }];
      resolve({ data, error: null });
    }
  };
  return { c, reads, writes, finish };
}

for (const file of ["app.js", "www/app.js"]) {
  for (const change of ["account", "logout", "client"]) {
    test(`${file}: late central read after ${change} cannot write menu, orders or revisions`, async () => {
      const h = harness(file), menu = h.c.menuCatalog, orders = h.c.savedOrders;
      const work = h.c.refreshCentralCloudState();
      assert.equal(h.reads.length, 3);
      if (change === "account") h.c.cloudState.user = { id: "restaurant-b" };
      if (change === "logout") h.c.cloudState.user = null;
      if (change === "client") h.c.cloudState.client = {};
      h.finish();
      assert.equal(await work, false);
      assert.equal(h.c.menuCatalog, menu);
      assert.equal(h.c.savedOrders, orders);
      assert.deepEqual(h.writes, []);
      assert.equal(h.c.centralSyncInProgress, false);
    });
  }

  test(`${file}: unchanged session applies confirmed data and preserves pending orders`, async () => {
    const h = harness(file);
    const work = h.c.refreshCentralCloudState();
    h.c.cloudState.user = { id: "restaurant-a" }; // Token refresh may replace the user object.
    h.finish();
    assert.equal(await work, true);
    assert.equal(h.c.menuCatalog.remote[0].id, "remote-dish");
    assert.deepEqual(Array.from(h.c.savedOrders, order => order.id), ["remote-order", "local-order"]);
    assert.equal(h.writes.filter(write => write.name === "revision").length, 2);
    assert.equal(h.writes.some(write => write.name === "error"), false);
  });
}
