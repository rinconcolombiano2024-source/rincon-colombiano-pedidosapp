import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../../restaurant-fiscal-ui.js", import.meta.url), "utf8");
const start = source.indexOf("/*\n * Capacitor native module links.");
const end = source.indexOf("/* RC ORDERA: read-only menu publication audit.", start);
assert.ok(start >= 0 && end > start, "Native navigation module exists");
const bridge = source.slice(start, end);

function harness({ native = true, href = "./cliente.html", id = "openClientPageButton", defaultPrevented = false, browserAvailable = true, browserOpen } = {}) {
  let listener;
  const opened = [];
  const messages = [];
  const toast = { hidden: true, set textContent(value) { messages.push(value); } };
  const document = {
    documentElement: { lang: "es" },
    addEventListener(name, callback) { if (name === "click") listener = callback; },
    getElementById() { return toast; }
  };
  const context = {
    document,
    URL,
    Promise,
    window: {
      location: { href: "https://localhost/restaurante.html" },
      Capacitor: {
        isNativePlatform: () => native,
        Plugins: { Browser: browserAvailable ? { open: browserOpen || (async ({ url }) => { opened.push(url); }) } : undefined }
      }
    }
  };
  vm.runInNewContext(bridge, context, { timeout: 1000 });
  let prevented = false;
  const anchor = { id, getAttribute: () => href };
  function click() {
    listener({
    target: { closest: () => anchor },
    defaultPrevented,
    preventDefault() { prevented = true; }
    });
  }
  click();
  return { opened, messages, click, get prevented() { return prevented; } };
}

test("Android resolves customer module against public HTTPS origin", async () => {
  const h = harness();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.prevented, true);
  assert.deepEqual(h.opened, ["https://rincon-colombiano-pedidosapp.vercel.app/cliente.html"]);
});

test("Android resolves stations against public HTTPS origin", async () => {
  const h = harness({ href: "./mesero.html?station=kitchen", id: "restaurantKitchenLink" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.prevented, true);
  assert.deepEqual(h.opened, ["https://rincon-colombiano-pedidosapp.vercel.app/mesero.html?station=kitchen"]);
});

test("Web navigation remains owned by the browser", async () => {
  const h = harness({ native: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.prevented, false);
  assert.deepEqual(h.opened, []);
});

test("Disallowed module URL cannot open through native bridge", async () => {
  const h = harness({ href: "https://evil.example/cliente.html" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.prevented, true);
  assert.deepEqual(h.opened, []);
  assert.equal(h.messages.length, 1);
});


test("Previously cancelled click never opens an external module", async () => {
  const h = harness({ defaultPrevented: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.prevented, false);
  assert.deepEqual(h.opened, []);
});

test("Missing native Browser plugin keeps restaurant open and explains upgrade", async () => {
  const h = harness({ browserAvailable: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.prevented, true);
  assert.deepEqual(h.opened, []);
  assert.equal(h.messages.length, 1);
});

test("Non-allowlisted HTTPS module path is blocked", async () => {
  const h = harness({ href: "https://rincon-colombiano-pedidosapp.vercel.app/admin.html" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.prevented, true);
  assert.deepEqual(h.opened, []);
  assert.equal(h.messages.length, 1);
});


test("Repeated native taps do not launch duplicate modules while opening", async () => {
  let release;
  const opened = [];
  const h = harness({ browserOpen: ({ url }) => {
    opened.push(url);
    return new Promise(resolve => { release = resolve; });
  } });
  h.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(opened.length, 1);
  release();
  await new Promise(resolve => setImmediate(resolve));
  h.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(opened.length, 2);
  release();
});

test("Browser launch failure is reported and a retry remains possible", async () => {
  let calls = 0;
  const h = harness({ browserOpen: async () => {
    calls += 1;
    if (calls === 1) throw new Error("Browser unavailable");
  } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.messages.length, 1);
  h.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
});
