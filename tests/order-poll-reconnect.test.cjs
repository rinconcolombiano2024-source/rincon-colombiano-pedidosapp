'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness(file) {
  const source = fs.readFileSync(file, 'utf8');
  const timers = new Map();
  let clock = 0, id = 0, reads = 0, rejectNext = false, release;
  const context = vm.createContext({
    clientOrdersTimer: null, clientOrdersPollGeneration: 0,
    clientOrdersPollInFlightGeneration: null, clientOrdersPollingDelay: 120000,
    CLIENT_ORDERS_POLL_MIN_MS: 120000, CLIENT_ORDERS_POLL_MAX_MS: 300000,
    clientOrdersRealtimeStatus: 'idle', canUseCustomerModule: () => true,
    navigator: { onLine: true }, document: { visibilityState: 'visible' },
    Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
    console: { error() {} },
    window: {
      setTimeout(fn, delay) { timers.set(++id, { fn, at: clock + delay }); return id; },
      clearTimeout(key) { timers.delete(key); },
    },
    async refreshClientOrders() {
      reads++;
      if (rejectNext) { rejectNext = false; throw new Error('database unavailable'); }
      if (release === true) await new Promise(resolve => { release = resolve; });
    },
  });
  vm.runInContext(source.slice(source.indexOf('function startClientOrdersPolling('),
    source.indexOf('function stopClientOrdersRealtime(')), context);
  return { context, timers, source, get reads() { return reads; },
    fail() { rejectNext = true; }, hold() { release = true; }, release() { release(); },
    async advance(ms) {
      clock += ms;
      for (const [key, task] of [...timers]) {
        if (task.at <= clock) { timers.delete(key); await task.fn(); }
      }
    },
    beginPoll() { const [key, task] = [...timers][0]; timers.delete(key); return task.fn(); },
  };
}

for (const file of ['app.js', 'www/app.js']) {
  test(file + ': failed reconnects cannot starve fallback reads or erase backoff', async () => {
    const h = harness(file);
    h.context.startClientOrdersPolling();
    await h.advance(60000);
    h.context.startClientOrdersPolling({ preserveExisting: true });
    await h.advance(60000);
    assert.equal(h.reads, 1);
    h.fail();
    await h.advance(120000);
    assert.equal(h.reads, 2);
    for (let i = 0; i < 3; i++) {
      await h.advance(60000);
      h.context.startClientOrdersPolling({ immediate: true, preserveExisting: true });
      assert.equal(h.reads, 2);
    }
    await h.advance(60000);
    assert.equal(h.reads, 3);
    assert.equal(h.timers.size, 1);
  });
  test(file + ': reconnect bursts during a pending read do not create duplicate loops', async () => {
    const h = harness(file);
    h.hold();
    h.context.startClientOrdersPolling({ immediate: true });
    const pending = h.beginPoll();
    for (let i = 0; i < 100; i++) h.context.startClientOrdersPolling({ immediate: true, preserveExisting: true });
    assert.equal(h.reads, 1);
    assert.equal(h.timers.size, 0);
    h.release(); await pending;
    assert.equal(h.timers.size, 1);
  });
  test(file + ': stop/restart invalidates an older pending read', async () => {
    const h = harness(file);
    h.hold(); h.context.startClientOrdersPolling();
    const pending = h.beginPoll();
    h.context.stopClientOrdersPolling();
    h.context.startClientOrdersPolling({ preserveExisting: true });
    assert.equal(h.timers.size, 1);
    h.release(); await pending;
    assert.equal(h.timers.size, 1);
    h.context.stopClientOrdersPolling();
    await h.advance(300000);
    assert.equal(h.reads, 1);
  });
  test(file + ': hidden/offline/subscribed clients do not poll', async () => {
    for (const state of ['hidden', 'offline', 'SUBSCRIBED']) {
      const h = harness(file);
      h.context.startClientOrdersPolling();
      if (state === 'hidden') h.context.document.visibilityState = 'hidden';
      if (state === 'offline') h.context.navigator.onLine = false;
      if (state === 'SUBSCRIBED') h.context.clientOrdersRealtimeStatus = state;
      await h.advance(300000);
      assert.equal(h.reads, 0); assert.equal(h.timers.size, 0);
    }
  });
  test(file + ': both Realtime fallback entrypoints preserve the existing loop', () => {
    const h = harness(file);
    const body = h.source.slice(h.source.indexOf('function startClientOrdersRealtime()'),
      h.source.indexOf('// Bound repeated courier-tracking reads'));
    assert.equal((body.match(/preserveExisting: true/g) || []).length, 2);
  });
}
