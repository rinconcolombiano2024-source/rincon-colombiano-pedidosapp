const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
function setup() {
  let expire;
  let cleared = false;
  const c = vm.createContext({
    AbortController,
    window: { setTimeout: fn => { expire = fn; return 1; }, clearTimeout: () => { cleared = true; } },
  });
  const start = source.indexOf("function withCloudTimeout(");
  const end = source.indexOf("function isTemporarySyncInfrastructureError(", start);
  vm.runInContext(source.slice(start, end), c);
  return { run: c.withCloudTimeout, expire: () => expire(), cleared: () => cleared };
}
test("timeout aborts every compatible request in a group", async () => {
  const h = setup();
  const signals = [];
  const builder = () => ({ abortSignal: signal => { signals.push(signal); return new Promise(() => {}); } });
  const operation = h.run([builder(), builder()]);
  const rejection = assert.rejects(operation, e => e.code === "RC_ORDERA_CLOUD_TIMEOUT");
  h.expire();
  await rejection;
  assert.equal(signals.length, 2);
  assert.ok(signals.every(s => s.aborted));
  assert.ok(h.cleared());
});
test("factory receives the signal and runs only once", async () => {
  const h = setup();
  let signal;
  let calls = 0;
  const operation = h.run(s => { signal = s; calls++; return new Promise(() => {}); });
  const rejection = assert.rejects(operation, e => e.name === "TimeoutError");
  h.expire();
  await rejection;
  assert.equal(calls, 1);
  assert.ok(signal.aborted);
});
test("successful compatible request is not cancelled", async () => {
  const h = setup();
  let signal;
  assert.equal(await h.run({ abortSignal: s => { signal = s; return Promise.resolve(42); } }), 42);
  assert.equal(signal.aborted, false);
  assert.ok(h.cleared());
});
