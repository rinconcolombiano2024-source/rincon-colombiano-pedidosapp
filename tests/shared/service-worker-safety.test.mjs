import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const workerCode = readFileSync(new URL("../../service-worker.js", import.meta.url), "utf8");
const workerUrl = "https://example.test/ordera/service-worker.js";

function createWorker() {
  const listeners = new Map();
  const entries = new Map();
  const opened = [];
  const notifications = [];
  const networkCalls = [];
  const windows = [];
  let offline = false;
  const resolveKey = (value) => new URL(typeof value === "string" ? value : value.url, workerUrl).href;
  const cache = {
    async match(key) { return entries.get(resolveKey(key)); },
    async put(key, value) { entries.set(resolveKey(key), value); },
    async addAll(files) {
      for (const file of files) entries.set(resolveKey(file), new Response("cached:" + file));
    }
  };
  const clients = {
    async matchAll() { return windows; },
    async openWindow(url) { opened.push(url); return { url }; },
    async claim() {}
  };
  const self = {
    location: new URL(workerUrl),
    clients,
    registration: { async showNotification(title, options) { notifications.push({ title, options }); } },
    addEventListener(type, callback) { listeners.set(type, callback); },
    skipWaiting() {}
  };
  runInNewContext(workerCode, {
    self, clients, caches: { async open() { return cache; }, async keys() { return []; } },
    fetch: async (request) => {
      networkCalls.push(request.url);
      if (offline) throw new Error("OFFLINE");
      return new Response("network:" + request.url);
    },
    URL, Response, TextDecoder, console
  }, { filename: "service-worker.js" });
  async function dispatch(type, event) {
    const awaits = [];
    let answer;
    const input = {
      ...event,
      respondWith(promise) { answer = promise; },
      waitUntil(promise) { awaits.push(promise); }
    };
    assert.equal(typeof listeners.get(type), "function", "missing " + type + " listener");
    listeners.get(type)(input);
    const result = answer === undefined ? undefined : await answer;
    await Promise.all(awaits);
    return result;
  }
  return {
    entries, opened, notifications, networkCalls, windows, dispatch,
    setOffline(value) { offline = value; },
    async get(url, destination = "script") {
      return dispatch("fetch", {
        request: { method: "GET", url, mode: destination === "document" ? "navigate" : "cors", destination }
      });
    }
  };
}

test("PWA bounds versioned static cache keys: 100 versions use one entry", async () => {
  const worker = createWorker();
  for (let i = 0; i < 100; i++) {
    const response = await worker.get("https://example.test/ordera/cliente.js?v=" + i);
    assert.equal(response.status, 200);
  }
  assert.deepEqual([...worker.entries.keys()], ["https://example.test/ordera/cliente.js"]);
  assert.equal(worker.networkCalls.length, 100, "preserve network-first semantics");
});

test("PWA does not cache unknown scripts or sensitive query-string navigation variants", async () => {
  const worker = createWorker();
  await worker.get("https://example.test/ordera/dynamic.js?token=secret");
  await worker.get("https://example.test/ordera/cliente.html?lang=pl&token=secret", "document");
  await worker.get("https://example.test/ordera/cliente.html?lang=en&token=another", "document");
  await worker.get("https://example.test/ordera/private.html?secret=1", "document");
  assert.deepEqual([...worker.entries.keys()], ["https://example.test/ordera/cliente.html"]);
});

test("PWA retains canonical offline fallback for versioned scripts", async () => {
  const worker = createWorker();
  await worker.get("https://example.test/ordera/cliente.js?v=1");
  worker.setOffline(true);
  const response = await worker.get("https://example.test/ordera/cliente.js?v=2");
  assert.equal(await response.text(), "network:https://example.test/ordera/cliente.js?v=1");
  const unknown = await worker.get("https://example.test/ordera/unknown.js?v=2");
  assert.equal(unknown.status, 503);
});

test("PWA pre-caches offline entrypoints: portal, integrations and local QR", async () => {
  const worker = createWorker();
  await worker.dispatch("install", {});
  for (const path of ["portal.html", "centro-integraciones.html", "centro-integraciones-status.js", "local-qr.js"]) {
    assert.ok(worker.entries.has("https://example.test/ordera/" + path), path);
  }
});

test("PWA handles null JSON push messages and retains fallback notification copy", async () => {
  const worker = createWorker();
  await worker.dispatch("push", { data: { json() { return null; } } });
  assert.equal(worker.notifications.length, 1);
  assert.match(worker.notifications[0].title, /RC ORDERA/);
  assert.match(worker.notifications[0].options.body, /pedido/);
});

test("PWA localizes Polish push and does not crash on array JSON", async () => {
  const worker = createWorker();
  await worker.dispatch("push", { data: { json() { return { language: "pl" }; } } });
  assert.match(worker.notifications[0].options.body, /zamówienie/);
  await worker.dispatch("push", { data: { json() { return []; } } });
  assert.equal(worker.notifications.length, 2);
});

test("PWA push click blocks external and javascript destinations without hijacking the POS", async () => {
  const worker = createWorker();
  let posNavigations = 0;
  let courierUrl = null, courierFocus = 0;
  worker.windows.push({
    url: "https://example.test/ordera/restaurante.html",
    navigate() { posNavigations++; throw new Error("POS_TAB_HIJACKED"); },
    focus() {}
  });
  const courier = {
    url: "https://example.test/ordera/colaborador.html",
    async navigate(url) { courierUrl = url; return this; },
    async focus() { courierFocus++; }
  };
  worker.windows.push(courier);
  for (const badUrl of ["https://attacker.example/collect", "javascript:alert(1)", "//attacker.example/evil", "https://example.test/ordera/admin.html"]) {
    await worker.dispatch("notificationclick", {
      notification: { data: { url: badUrl }, close() {} }
    });
    assert.equal(courierUrl, "https://example.test/ordera/colaborador.html?view=offers&app=v91.0.4");
  }
  assert.equal(posNavigations, 0);
  assert.equal(courierFocus, 4);
  assert.equal(worker.opened.length, 0);
});

test("PWA push click preserves safe courier deep links and opens a new tab when needed", async () => {
  const worker = createWorker();
  const deepLink = "./colaborador.html?view=offers&lang=pl&assignment=00000000-0000-4000-8000-000000000001";
  worker.windows.push({ url: "https://example.test/ordera/cliente.html", navigate() { throw Error("wrong tab"); }, focus() {} });
  await worker.dispatch("notificationclick", { notification: { data: { url: deepLink }, close() {} } });
  assert.equal(worker.opened.length, 1);
  assert.equal(worker.opened[0], new URL(deepLink, workerUrl).href);
  assert.match(worker.opened[0], /lang=pl/);
});
