"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert.equal(app, fs.readFileSync(path.join(root, "www/app.js"), "utf8"),
  "Web/Android share the exact same menu-save implementation");

const start = app.indexOf("// One in-flight save per restaurant");
const end = app.indexOf("function readCurrencySymbol()", start);
assert.ok(start > 0 && end > start, "Menu-save flight guard must be present");

function harness() {
  const responses = [];
  let calls = 0;
  let pending = true;
  const cloudState = { client: {}, user: { id: "restaurant-one" } };
  const context = vm.createContext({
    cloudState, navigator: { onLine: true },
    hasPendingMenu: () => pending,
    saveMenuWhenPossibleNow: () => {
      calls++;
      return new Promise(resolve => responses.push(resolve));
    },
    Promise
  });
  vm.runInContext("let menuSaveQueue = Promise.resolve();\n" + app.slice(start, end), context);
  const tick = async () => { await Promise.resolve(); await Promise.resolve(); await new Promise(resolve => setImmediate(resolve)); };
  return { context, cloudState, responses, tick,
    get calls() { return calls; },
    setPending: next => { pending = next; },
    save: () => context.saveMenuWhenPossible({ silent: true })
  };
}

test("A burst of twenty menu edits generates one RPC and at most one trailing RPC", async () => {
  const h = harness();
  const first = h.save();
  await h.tick();
  const peers = Array.from({ length: 19 }, () => h.save());
  assert.equal(h.calls, 1);
  h.responses[0]({ pending: true });
  await h.tick();
  assert.equal(h.calls, 2, "A newer local draft receives one trailing publish");
  h.setPending(false);
  h.responses[1]({ synced: true });
  const results = await Promise.all([first, ...peers]);
  assert.equal(results.length, 20);
  assert.ok(results.every(result => result.synced === true));
  assert.equal(h.calls, 2);
});

test("An unchanged menu does not receive a redundant trailing write", async () => {
  const h = harness();
  const first = h.save();
  await h.tick();
  const second = h.save();
  h.setPending(false);
  h.responses[0]({ synced: true });
  await Promise.all([first, second]);
  assert.equal(h.calls, 1);
});

test("A failed publication is not automatically retried even with queued edits", async () => {
  const h = harness();
  const first = h.save();
  await h.tick();
  const second = h.save();
  h.responses[0]({ pending: true, error: new Error("PostgREST unavailable") });
  const results = await Promise.all([first, second]);
  assert.equal(h.calls, 1);
  assert.equal(results[0].pending, true);
});

test("A session switch cannot attach another restaurant's request to an earlier flight", async () => {
  const h = harness();
  const first = h.save();
  await h.tick();
  h.cloudState.user = { id: "restaurant-two" };
  const result = await h.save();
  assert.equal(result.pending, true);
  h.responses[0]({ pending: true });
  await first;
  assert.equal(h.calls, 1);
});

test("Edits during the trailing RPC stay pending and can be saved in a later explicit action", async () => {
  const h = harness();
  const one = h.save();
  await h.tick();
  const two = h.save();
  h.responses[0]({ pending: true });
  await h.tick();
  const three = h.save();
  h.responses[1]({ pending: true });
  await Promise.all([one, two, three]);
  assert.equal(h.calls, 2, "Never enter an unbounded save loop");
  const later = h.save();
  await h.tick();
  assert.equal(h.calls, 3);
  h.setPending(false);
  h.responses[2]({ synced: true });
  assert.equal((await later).synced, true);
});
