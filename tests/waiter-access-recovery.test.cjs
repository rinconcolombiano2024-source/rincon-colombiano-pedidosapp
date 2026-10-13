"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const load = name => fs.readFileSync(path.join(root, name), "utf8");
assert.equal(load("mesero.js"), load("www/mesero.js"), "station runtime must be identical");
assert.equal(load("mesero.html"), load("www/mesero.html"), "station HTML must be identical");
assert.equal(load("styles.css"), load("www/styles.css"), "station styles must be identical");
const source = load("mesero.js");
const slice = (start, end) => {
  const i = source.indexOf(start);
  const j = source.indexOf(end, i + start.length);
  assert.ok(i >= 0 && j > i, "missing " + start);
  return source.slice(i, j);
};

test("unauthorized station has retry, switch-account and always-available home without granting rights", () => {
  for (const name of ["mesero.html", "www/mesero.html"]) {
    const html = load(name);
    assert.match(html, /id="waiterRetryAccessButton"[^>]*type="button"/);
    assert.match(html, /id="waiterAccessSwitchAccountButton"[^>]*type="button"/);
    assert.match(html, /id="waiterAccessHomeLink"[^>]*href="\.\/index\.html"/);
    assert.match(html, /id="waiterAuthForm"/);
  }
  assert.match(source, /switchAccountButton: document\.querySelector\("#waiterAccessSwitchAccountButton"\)/);
  assert.match(source, /switchAccountButton\?\.addEventListener\("click", waiterSwitchAccount\)/);
  assert.match(source, /authorizationUserId = waiterUser\.id/);
  assert.match(source, /waiterUser\?\.id !== authorizationUserId/g);
});

function mockElements() {
  const button = { disabled: false };
  const elements = {
    switchAccountButton: button,
    accessMessage: { textContent: "" },
    email: { value: "old@example.test", focused: false, focus() { this.focused = true; } },
    password: { value: "not-real-password" },
    recoveryForm: { hidden: false },
    authForm: { hidden: true },
    authMessage: { textContent: "" },
    accessCard: { hidden: false },
    authCard: { hidden: true },
    app: { hidden: true },
    stationBoard: { hidden: true },
    shiftBar: { hidden: true },
    signOutButton: { hidden: true },
  };
  return { button, elements };
}

test("switch-account signs out locally, returns to the station sign-in screen, never opens protected station", async () => {
  const { button, elements } = mockElements();
  const signedOut = [];
  const ctx = vm.createContext({
    waiterClient: { auth: { signOut: async (options) => { signedOut.push(options); return { error: null }; } } },
    waiterUser: { id: "old-account" },
    waiterMembership: { station: "kitchen" },
    waiterMemberships: [{ station: "kitchen" }],
    waiterBusinessContext: { private: true },
    waiterAuthorizeInFlight: Promise.resolve(true),
    waiterAuthorizeLastCompletedAt: 999999,
    waiterStopRealtime: () => {},
    waiterElements: elements,
    waiterRenderLoggedOut: () => {
      elements.authCard.hidden = false;
      elements.accessCard.hidden = true;
      elements.stationBoard.hidden = true;
      elements.app.hidden = true;
    },
    waiterSetMessage: (el, message) => { el.textContent = message; },
    console: { error: () => {} },
  });
  vm.runInContext(slice("async function waiterSwitchAccount() {", "async function waiterSignOut() {"), ctx);
  await ctx.waiterSwitchAccount();
  assert.equal(signedOut.length, 1);
  assert.equal(signedOut[0].scope, "local", "do not globally log out restaurant/operator sessions");
  assert.equal(ctx.waiterUser, null);
  assert.equal(ctx.waiterMembership, null);
  assert.equal(ctx.waiterMemberships.length, 0);
  assert.equal(ctx.waiterAuthorizeInFlight, null);
  assert.equal(ctx.waiterAuthorizeLastCompletedAt, 0);
  assert.equal(elements.accessCard.hidden, true);
  assert.equal(elements.authCard.hidden, false);
  assert.equal(elements.app.hidden, true);
  assert.equal(elements.stationBoard.hidden, true);
  assert.equal(elements.email.value, "");
  assert.equal(elements.email.focused, true);
  assert.equal(elements.password.value, "");
  assert.equal(elements.authForm.hidden, false);
  assert.equal(button.disabled, false);
});

test("failed sign-out never pretends user was logged out or grants station access", async () => {
  const { button, elements } = mockElements();
  const existingUser = { id: "existing-account" };
  const ctx = vm.createContext({
    waiterClient: { auth: { signOut: async () => ({ error: new Error("network unavailable") }) } },
    waiterUser: existingUser,
    waiterMembership: null,
    waiterMemberships: [],
    waiterBusinessContext: null,
    waiterAuthorizeInFlight: null,
    waiterAuthorizeLastCompletedAt: 0,
    waiterStopRealtime: () => { throw Error("should not disconnect before sign-out succeeds"); },
    waiterElements: elements,
    waiterRenderLoggedOut: () => { throw Error("cannot display sign-in after failed signout"); },
    waiterSetMessage: () => {},
    console: { error: () => {} },
  });
  vm.runInContext(slice("async function waiterSwitchAccount() {", "async function waiterSignOut() {"), ctx);
  await ctx.waiterSwitchAccount();
  assert.equal(ctx.waiterUser, existingUser);
  assert.equal(elements.accessCard.hidden, false);
  assert.equal(elements.authCard.hidden, true);
  assert.match(elements.accessMessage.textContent, /volver al inicio/);
  assert.equal(button.disabled, false);
});

test("stale authorization claim cannot reopen blocked card after changing account", async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const { elements } = mockElements();
  const ctx = vm.createContext({
    waiterRecoveringPassword: false,
    waiterClient: { rpc: async () => pending },
    waiterUser: { id: "former-account", email: "former@example.test" },
    waiterStoreId: "restaurant-id",
    waiterAuthorizeInFlight: null,
    waiterAuthorizeLastCompletedAt: 0,
    WAITER_RECOVERY_DEDUP_MS: 30000,
    waiterSetStatus: () => {},
    waiterElements: elements,
    Date,
    console: { error: () => {} },
  });
  vm.runInContext(slice("function waiterAuthorize(options = {}) {", "async function waiterActivateAuthorization() {"), ctx);
  const initial = ctx.waiterAuthorize({ force: true });
  ctx.waiterUser = { id: "new-account", email: "new@example.test" };
  release({ error: new Error("OLD_INVITATION_ERROR") });
  const result = await initial;
  assert.equal(result, false);
  assert.equal(elements.accessCard.hidden, false);
  assert.equal(elements.authCard.hidden, true);
  assert.equal(elements.accessMessage.textContent, "");
});

test("station access recovery has local Spanish, Polish and English text", () => {
  assert.equal(load("offline-i18n.js"), load("www/offline-i18n.js"));
  const browser = { window: {} };
  vm.runInNewContext(load("offline-i18n.js"), browser);
  const i18n = browser.window.RC_ORDERA_OFFLINE_I18N;
  const captions = [
    "Opciones de acceso a Estaciones",
    "Activar autorización",
    "Iniciar sesión / Cambiar cuenta",
    "Volver al inicio de RC ORDERA",
    "Inicia sesión con una cuenta autorizada por el restaurante.",
    "No fue posible cerrar la sesión. Comprueba internet y vuelve a intentarlo. También puedes volver al inicio.",
  ];
  for (const caption of captions) {
    assert.ok(i18n.keyForSource(caption), "missing offline translation key for " + caption);
    for (const language of ["pl", "en"]) {
      const translated = i18n.translate(caption, language);
      assert.ok(translated && translated !== caption, language + ": " + caption);
    }
  }
});
