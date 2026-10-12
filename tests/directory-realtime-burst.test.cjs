"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function directoryHarness(file) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const start = source.indexOf("function customerScheduleDirectoryRefresh() {");
  const end = source.indexOf("function customerScheduleDirectoryPoll(", start);
  assert.ok(start >= 0 && end > start, "directory refresh function exists");
  const timers = new Map();
  let nextId = 0;
  let reads = 0;
  let canceled = 0;
  const context = vm.createContext({
    customerDirectoryRealtimeTimer: null,
    document: { visibilityState: "visible" },
    window: {
      navigator: { onLine: true },
      setTimeout(fn, delay) {
        const id = ++nextId;
        timers.set(id, { fn, delay });
        return id;
      },
      clearTimeout(id) {
        canceled++;
        timers.delete(id);
      }
    },
    customerLoadRestaurantDirectory: async ({ silent }) => {
      assert.equal(silent, true);
      reads++;
      return true;
    }
  });
  vm.runInContext(source.slice(start, end), context, { filename: file });
  return {
    context, timers,
    get reads() { return reads; },
    get canceled() { return canceled; },
    fire() {
      const entry = timers.entries().next().value;
      assert.ok(entry, "one scheduled refresh");
      const [id, task] = entry;
      timers.delete(id);
      task.fn();
    }
  };
}

for (const file of ["cliente.js", "www/cliente.js"]) {
  test(file + ": 1000 Realtime events schedule exactly one bounded directory read", async () => {
    const h = directoryHarness(file);
    for (let i = 0; i < 1000; i++) h.context.customerScheduleDirectoryRefresh();
    assert.equal(h.timers.size, 1);
    assert.equal([...h.timers.values()][0].delay, 5000);
    assert.equal(h.canceled, 0, "subsequent events must not reset the coalescing window");
    assert.equal(h.reads, 0);
    h.fire();
    await Promise.resolve();
    assert.equal(h.reads, 1);
    assert.equal(h.timers.size, 0);
    h.context.customerScheduleDirectoryRefresh();
    assert.equal(h.timers.size, 1, "another window can refresh after the first completes");
    h.fire();
    await Promise.resolve();
    assert.equal(h.reads, 2);
  });

  test(file + ": hidden or offline customers do not query Supabase", async () => {
    const h = directoryHarness(file);
    h.context.document.visibilityState = "hidden";
    for (let i = 0; i < 100; i++) h.context.customerScheduleDirectoryRefresh();
    assert.equal(h.timers.size, 0);
    h.context.document.visibilityState = "visible";
    h.context.window.navigator.onLine = false;
    h.context.customerScheduleDirectoryRefresh();
    assert.equal(h.timers.size, 0);
    h.context.window.navigator.onLine = true;
    h.context.customerScheduleDirectoryRefresh();
    assert.equal(h.timers.size, 1);
    h.context.document.visibilityState = "hidden";
    h.fire();
    await Promise.resolve();
    assert.equal(h.reads, 0, "visibility re-checked when timer fires");
  });
}
