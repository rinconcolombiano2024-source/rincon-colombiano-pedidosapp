const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.RC_CPU_APP_SOURCE || path.join(__dirname, '../app.js'), 'utf8');
function section(start, end) {
  const i = source.indexOf(start), j = source.indexOf(end, i + start.length);
  assert.ok(i >= 0 && j > i, `Missing source: ${start}`);
  return source.slice(i, j);
}
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function runtime(extra = {}) {
  let now = 1000000, id = 0;
  const timers = new Map(), microtasks = [];
  const c = vm.createContext({
    AbortController, Map, Set, console: { warn() {}, error() {}, info() {} },
    Date: class extends Date { static now() { return now; } },
    Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
    navigator: { onLine: true }, document: { visibilityState: 'visible' },
    window: { setTimeout(fn, delay) { timers.set(++id, { fn, delay }); return id; }, clearTimeout(i) { timers.delete(i); } },
    queueMicrotask: fn => microtasks.push(fn),
    cloudState: { client: {}, user: { id: 'owner' } },
    appUiText: text => text, structuredCloneOrder: obj => JSON.parse(JSON.stringify(obj)),
    ...extra,
  });
  vm.runInContext(section('function withCloudTimeout(', 'function isCancelledOrderOverwriteError('), c);
  return { c, timers, microtasks, advance: ms => { now += ms; } };
}
function wrapper(h, internal) {
  if (internal) h.c.saveCloudOrderInternal = internal;
  vm.runInContext(section('const cloudOrderSaveInFlight =', 'async function saveCloudOrderInternal('), h.c);
}
const order = (id = 'one') => ({ id, saved: true, updatedAt: 'edit-1', syncStatus: 'pending', _syncRevision: 1, items: [{ name: 'local', qty: 1 }] });

test('100 saves of the same edition share one operation', async () => {
  const h = runtime(), d = deferred(); let calls = 0;
  wrapper(h, () => { calls++; return d.promise; });
  const work = Array.from({ length: 100 }, () => h.c.saveCloudOrder(order()));
  await tick(); assert.equal(calls, 1);
  d.resolve(); await Promise.all(work);
  assert.equal(vm.runInContext('cloudOrderSaveInFlight.size', h.c), 0);
});

test('a different local edition cannot reuse another edition confirmation', async () => {
  const h = runtime(), d = deferred(); let calls = 0;
  wrapper(h, () => { calls++; return d.promise; });
  const first = h.c.saveCloudOrder(order()); await tick();
  const newer = { ...order(), updatedAt: 'edit-2' };
  const second = h.c.saveCloudOrder(newer);
  const rejected = assert.rejects(second, e => e.code === 'RC_ORDERA_ORDER_NOT_CONFIRMED');
  d.resolve(); await first; await rejected;
  assert.equal(calls, 1); assert.equal(newer.syncStatus, 'pending');
});

test('an aborted queued save never starts a later RPC', async () => {
  const h = runtime(), d = deferred(), ac = new AbortController(); const calls = [];
  wrapper(h, o => { calls.push(o.id); return d.promise; });
  const first = h.c.saveCloudOrder(order('one')); await tick();
  const second = h.c.saveCloudOrder(order('two'), ac.signal);
  const rejected = assert.rejects(second, e => e.name === 'AbortError');
  ac.abort(); d.resolve(); await first; await rejected;
  assert.deepEqual(calls, ['one']);
});

test('a queued order is not sent under a different account', async () => {
  const h = runtime(), d = deferred(); const calls = [];
  wrapper(h, o => { calls.push(o.id); return d.promise; });
  const first = h.c.saveCloudOrder(order()); await tick();
  const second = h.c.saveCloudOrder(order('two'));
  const rejected = assert.rejects(second);
  h.c.cloudState.user = { id: 'other' }; d.resolve(); await first; await rejected;
  assert.deepEqual(calls, ['one']);
});

function query(response, seen = []) {
  const request = {
    select() { return this; }, eq() { return this; }, in() { return this; },
    limit() { return this; }, order() { return this; }, maybeSingle() { return this; },
    abortSignal(signal) { this.signal = signal; seen.push(signal); return this; },
    then(ok, fail) {
      if (response !== undefined) return Promise.resolve(response).then(ok, fail);
      return new Promise(resolve => {
        const finish = () => resolve({ data: null, error: Object.assign(new Error('aborted'), { name: 'AbortError' }) });
        if (this.signal?.aborted) finish();
        else this.signal?.addEventListener('abort', finish, { once: true });
      }).then(ok, fail);
    },
  };
  return request;
}

test('parent cancellation reaches both reconciliation queries', async () => {
  const h = runtime(), ac = new AbortController(), signals = [];
  const work = h.c.withCloudTimeout([query(undefined, signals), query(undefined, signals)], undefined, 8000, ac.signal);
  await tick(); ac.abort(); await work;
  assert.equal(signals.length, 2); assert.ok(signals.every(s => s.aborted)); assert.equal(h.timers.size, 0);
});

test('pre-aborted operation does not execute its factory', async () => {
  const h = runtime(), ac = new AbortController(); let calls = 0;
  ac.abort(); await assert.rejects(h.c.withCloudTimeout(() => { calls++; }, undefined, 8000, ac.signal));
  assert.equal(calls, 0); assert.equal(h.timers.size, 0);
});

function realOrder(rpc, from) {
  const h = runtime({
    cloudState: { client: { rpc, from }, user: { id: 'owner' } }, savedOrders: [], currentOrder: { id: 'other' },
    orderBusinessDate: () => '2026-09-19', orderTotal: () => 20,
    saveOrders() {}, saveCurrentOrderDraft() {}, saveRevisionConflictBackup: () => true,
    readRevisionConflictBackups: () => ({ ok: true, backups: [] }),
    blockOrderRevisionSync: o => { o._syncBlockedReason = 'revision_conflict'; },
    isOrderRevisionSyncBlocked: o => o._syncBlockedReason === 'revision_conflict',
  });
  vm.runInContext(section('function isCancelledOrderOverwriteError(', 'function needsCloudSync('), h.c);
  vm.runInContext(section('async function saveCloudOrderInternal(', 'async function voidCloudOrder('), h.c);
  wrapper(h);
  return h;
}

test('an edit made during the RPC remains pending after the older edit is confirmed', async () => {
  const d = deferred(), o = order();
  const h = realOrder(() => query(d.promise)); h.c.savedOrders = [o];
  const work = h.c.saveCloudOrder(o); const rejected = assert.rejects(work, e => e.code === 'RC_ORDERA_ORDER_NOT_CONFIRMED');
  await tick(); o.updatedAt = 'edit-2'; o.items[0].qty = 2;
  d.resolve({ data: { order_id: o.id, revision: 2, customer_order_id: 'published' }, error: null });
  await rejected;
  assert.equal(o.syncStatus, 'pending'); assert.equal(o._syncRevision, 2); assert.equal(o.items[0].qty, 2);
});

test('a confirmed conflict blocks further writes, retaining local contents and revision', async () => {
  let calls = 0; const o = order();
  const h = realOrder(() => { calls++; return query({ error: { code: '40001', message: 'ORDER_REVISION_CONFLICT: expected 1, current 2' } }); },
    table => query({ data: table === 'orders' ? { revision: 2, order_json: { updatedAt: 'remote-edit' } } : { id: 'pub' } }));
  await assert.rejects(h.c.saveCloudOrder(o), e => e.code === 'ORDER_REVISION_CONFLICT');
  for (let i = 0; i < 20; i++) await assert.rejects(h.c.saveCloudOrder(o), e => e.code === 'ORDER_REVISION_CONFLICT');
  assert.equal(calls, 1); assert.equal(o._syncRevision, 1); assert.equal(o.syncStatus, 'pending'); assert.equal(o.items[0].name, 'local');
});

test('lost confirmation recovers the same edition without another write', async () => {
  let calls = 0; const o = order();
  const h = realOrder(() => { calls++; return query({ error: { code: '40001', message: 'ORDER_REVISION_CONFLICT' } }); },
    table => query({ data: table === 'orders' ? { revision: 2, order_json: { updatedAt: o.updatedAt } } : { id: 'pub' } }));
  await h.c.saveCloudOrder(o);
  assert.equal(calls, 1); assert.equal(o._syncRevision, 2); assert.equal(o.customerOrderId, 'pub');
});

test('outer order abort also cancels reconciliation reads and does not overwrite local data', async () => {
  const ac = new AbortController(), signals = [], o = order();
  const h = realOrder(() => query({ error: { code: '40001', message: 'ORDER_REVISION_CONFLICT' } }), () => query(undefined, signals));
  const work = h.c.saveCloudOrder(o, ac.signal); const rejected = assert.rejects(work, e => e.name === 'AbortError');
  await tick(); ac.abort(); await rejected;
  assert.equal(signals.length, 2); assert.ok(signals.every(s => s.aborted)); assert.equal(o._syncRevision, 1);
});

function incoming(perform) {
  const h = runtime({
    CLIENT_ORDERS_POLL_MIN_MS: 120000, CLIENT_ORDERS_POLL_MAX_MS: 300000,
    clientOrdersRefreshInFlight: null, clientOrdersRefreshPending: false,
    clientOrdersRefreshRetryNotBefore: 0, clientOrdersRefreshRetryDelay: 120000,
    clientOrdersRefreshLastError: null, clientOrdersRefreshUserId: null, clientOrdersRealtimeNeedsCatchup: false,
    performClientOrdersRefresh: perform,
  });
  vm.runInContext(section('async function refreshClientOrders(', 'async function performClientOrdersRefresh('), h.c);
  return h;
}

test('100 concurrent incoming refreshes do not schedule an empty follow-up', async () => {
  const d = deferred(); let calls = 0;
  const h = incoming(() => { calls++; return d.promise; });
  const work = Array.from({ length: 100 }, () => h.c.refreshClientOrders());
  d.resolve(); await Promise.all(work);
  assert.equal(calls, 1); assert.equal(h.microtasks.length, 0);
});

test('incoming 503 cannot be bypassed by reconnect or foreground calls; it recovers after backoff', async () => {
  let calls = 0, fails = true;
  const h = incoming(async () => { calls++; if (fails) throw { status: 503 }; });
  await assert.rejects(h.c.refreshClientOrders());
  for (let i = 0; i < 100; i++) await assert.rejects(h.c.refreshClientOrders());
  assert.equal(calls, 1); assert.equal(h.microtasks.length, 0);
  h.advance(240000); fails = false; await h.c.refreshClientOrders();
  assert.equal(calls, 2); assert.equal(h.c.clientOrdersRefreshRetryNotBefore, 0);
});

test('explicit catch-up is retained once after a successful read, never immediately after failure', async () => {
  for (const fail of [false, true]) {
    const d = deferred();
    const h = incoming(async () => { await d.promise; if (fail) throw { status: 503 }; });
    const work = [h.c.refreshClientOrders(), h.c.refreshClientOrders({ reconcileAfterInFlight: true })];
    const settled = Promise.allSettled(work); d.resolve(); await settled;
    assert.equal(h.microtasks.length, fail ? 0 : 1);
  }
});

test('pending retry uses one timer and never bypasses the infrastructure deadline', () => {
  const h = runtime({ pendingDataSyncRetryTimer: null, pendingDataSyncRetryDueAt: 0, pendingDataSyncRetryNotBefore: 0 });
  vm.runInContext(section('function schedulePendingDataSyncRetry(', 'function schedulePendingOrderRecovery('), h.c);
  h.c.schedulePendingDataSyncRetry(5000);
  h.c.pendingDataSyncRetryNotBefore = h.c.Date.now() + 300000;
  for (let i = 0; i < 100; i++) h.c.schedulePendingDataSyncRetry(5000);
  assert.equal(h.timers.size, 1); assert.equal([...h.timers.values()][0].delay, 300000);
});

test('joining pending synchronization does not request another round', async () => {
  const d = deferred(); let calls = 0;
  const h = runtime({ pendingDataSyncInFlight: null, pendingDataSyncRequested: false, pendingDataSyncRetryNotBefore: 0,
    runPendingDataSync: () => { calls++; return d.promise; }, updateCloudStatus() {} });
  vm.runInContext(section('function syncPendingData(', 'function schedulePendingDataSyncRetry('), h.c);
  const work = Array.from({ length: 100 }, () => h.c.syncPendingData());
  assert.equal(calls, 1); assert.equal(h.c.pendingDataSyncRequested, false);
  d.resolve(true); await Promise.all(work);
});

test('root and www app.js are byte-identical, central Realtime remains disabled', () => {
  if (!process.env.RC_CPU_APP_SOURCE) assert.deepEqual(fs.readFileSync(path.join(__dirname, '../app.js')), fs.readFileSync(path.join(__dirname, '../www/app.js')));
  assert.match(source, /const CENTRAL_REALTIME_ENABLED = false;/);
});

test('an order added during synchronization is retained and receives one delayed follow-up', async () => {
  const d = deferred(), first = order(), late = order('late');
  const h = runtime({
    savedOrders: [first], currentOrder: { id: 'draft' },
    cloudState: { user: { id: 'owner' }, client: { from: () => query({ data: [], error: null }) } },
    SYNC_ORDER_BATCH_SIZE: 5, SYNC_ORDER_BATCH_DELAY_MS: 15000, SYNC_INFRASTRUCTURE_BACKOFF_MS: 300000,
    pendingDataSyncRequested: false, pendingDataSyncRetryTimer: null,
    pendingDataSyncRetryDueAt: 0, pendingDataSyncRetryNotBefore: 0,
    readDeletedOrderIds: () => [], currentSettingsPendingToken: () => null,
    currentMenuPendingToken: () => null, pendingTicketCounter: () => null,
    needsAutomaticCloudSync: o => o.syncStatus === 'pending' && !o._syncBlockedReason,
    saveCloudOrder: () => d.promise,
    confirmOrderSyncedIfUnchanged: () => { first.syncStatus = 'synced'; },
    advanceCloudTicketCounter: async () => {}, orderBusinessDate: () => '2026-09-19',
    todayKey: '2026-09-19', nextTicket: 1,
    saveOrders() {}, saveCurrentOrderDraft() {}, saveTicketState() {},
    renderOrder() {}, renderHistory() {}, updateCloudStatus() {},
    setCloudError: e => { throw e; },
  });
  h.c.hasPendingDataToSync = () => h.c.savedOrders.some(h.c.needsAutomaticCloudSync);
  vm.runInContext(section('function schedulePendingDataSyncRetry(', 'function schedulePendingOrderRecovery('), h.c);
  vm.runInContext(section('async function runPendingDataSync(', 'async function signInWithEmail('), h.c);
  const work = h.c.runPendingDataSync({ silent: true }); await tick();
  h.c.savedOrders.push(late); d.resolve(); assert.equal(await work, true);
  assert.equal(late.syncStatus, 'pending'); assert.equal(first.syncStatus, 'synced');
  assert.equal(h.timers.size, 1); assert.equal([...h.timers.values()][0].delay, 15000);
});
