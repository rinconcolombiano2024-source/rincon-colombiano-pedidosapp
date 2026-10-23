"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

const source = readFileSync("cliente.js", "utf8");
const bundled = readFileSync("www/cliente.js", "utf8");
assert.equal(source, bundled, "Production Android/www client must match browser client");
const start = source.indexOf("async function customerReadDirectoryWithTimeout(");
const end = source.indexOf("async function customerLoadRestaurantDirectoryNow(", start);
assert.ok(start >= 0 && end > start);
const functionSource = source.slice(start, end);
function createHarness() {
  const timers = new Map();
  let nextTimer = 0;
  const ctx = vm.createContext({
    AbortController,
    setTimeout(callback, ms) {
      const id = ++nextTimer;
      timers.set(id, { callback, ms });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  vm.runInContext(functionSource, ctx);
  return { ctx, timers };
}

test("timeout cancels a still-running Supabase directory request", async () => {
  const {ctx, timers} = createHarness();
  let capturedSignal;
  const result = ctx.customerReadDirectoryWithTimeout((signal) => {
    capturedSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("HTTP request aborted")), { once: true });
    });
  });
  await Promise.resolve();
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].ms, 12000);
  assert.equal(capturedSignal.aborted, false);
  [...timers.values()][0].callback();
  const settled = await result;
  assert.equal(settled.error.code, "DIRECTORY_TIMEOUT");
  assert.equal(capturedSignal.aborted, true);
  assert.equal(timers.size, 0, "Deadline timer is always cleaned up");
});

test("fast directory requests succeed without cancelling the fetch", async () => {
  const { ctx, timers } = createHarness();
  let capturedSignal;
  const expected = { data: [{ userId: "fixture" }], error: null };
  const outcome = await ctx.customerReadDirectoryWithTimeout((signal) => {
    capturedSignal = signal;
    return Promise.resolve(expected);
  });
  assert.deepEqual(outcome, expected);
  assert.equal(capturedSignal.aborted, false);
  assert.equal(timers.size, 0);
});

test("both RPC and missing-RPC fallback attach the deadline to PostgREST", () => {
  assert.match(source, /client\.rpc\("get_public_restaurant_directory_by_region"/);
  const calls = source.match(/typeof request\?\.abortSignal === "function"/g) || [];
  assert.equal(calls.length, 2, "Both public RPC and fallback REST read must be cancellable");
  assert.match(source, /request\.abortSignal\(signal\)/);
  assert.match(source, /customerIsMissingRpc\(error\)/, "Keep original fallback");
  assert.match(source, /requestedScope !== customerDirectoryScopeKey\(\)/, "Keep stale-region protection");
});
