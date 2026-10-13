"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert.equal(app, fs.readFileSync(path.join(root, "www/app.js"), "utf8"));
const from = app.indexOf("async function saveCloudMenu() {");
const to = app.indexOf("async function saveRestaurantPublicProfile()", from);
assert.ok(from > 0 && to > from);

function harness({ imageDeferred = false, rpcDeferred = false } = {}) {
  const localMenu = { Main: [{ id: "one", name: "Tamal", price: 48 }] };
  const state = { client: null, user: { id: "restaurant-A" } };
  let rpcCalls = 0, confirmCalls = 0, releaseImage, releaseRpc;
  const oldClient = {
    rpc: () => {
      rpcCalls++;
      if (rpcDeferred) return new Promise(resolve => { releaseRpc = resolve; });
      return Promise.resolve({ data: { menu: localMenu, menu_revision: 1 }, error: null });
    }
  };
  state.client = oldClient;
  const ctx = vm.createContext({
    cloudState: state, menuCatalog: localMenu, navigator: { onLine: true },
    STORAGE_KEYS: { menuRevision: "menu-revision" },
    elements: { menuEditorDialog: { open: false } },
    appUiText: message => message,
    normalizeMenuCatalog: menu => menu,
    materializeMenuImagesForCloud: () => imageDeferred
      ? new Promise(resolve => { releaseImage = resolve; })
      : Promise.resolve(localMenu),
    menuCatalogsMatch: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    saveMenuCache: () => {}, renderMenu: () => {}, renderMenuEditor: () => {},
    storedCloudRevision: () => 1,
    isMenuRevisionConflict: () => false,
    isMissingRestaurantRpc: () => false,
    confirmSavedCloudMenu: async () => { confirmCalls++; return { menu: localMenu, menuRevision: 1 }; }
  });
  vm.runInContext(app.slice(from, to), ctx);
  return {
    state,
    save: () => ctx.saveCloudMenu(),
    releaseImage: () => releaseImage(localMenu),
    releaseRpc: () => releaseRpc({ data: { menu: localMenu, menu_revision: 2 }, error: null }),
    get rpcCalls() { return rpcCalls; },
    get confirmCalls() { return confirmCalls; }
  };
}

test("Image upload completion after switching restaurants does not write to another account", async () => {
  const h = harness({ imageDeferred: true });
  const save = h.save();
  h.state.user = { id: "restaurant-B" };
  h.releaseImage();
  await assert.rejects(save, error => error.code === "RC_ORDERA_MENU_SESSION_CHANGED");
  assert.equal(h.rpcCalls, 0);
  assert.equal(h.confirmCalls, 0);
});

test("A late RPC from the previous account cannot replace the next account's menu", async () => {
  const h = harness({ rpcDeferred: true });
  const save = h.save();
  await Promise.resolve();
  h.state.user = { id: "restaurant-B" };
  h.releaseRpc();
  await assert.rejects(save, error => error.code === "RC_ORDERA_MENU_SESSION_CHANGED");
  assert.equal(h.rpcCalls, 1);
  assert.equal(h.confirmCalls, 0);
});

test("An unchanged session still confirms and publishes its own menu", async () => {
  const h = harness();
  const result = await h.save();
  assert.equal(result.menuRevision, 1);
  assert.equal(h.rpcCalls, 1);
  assert.equal(h.confirmCalls, 1);
});
