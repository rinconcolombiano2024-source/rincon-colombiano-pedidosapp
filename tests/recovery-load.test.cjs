const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

function runtime(extra = {}) {
  let now = 100000, nextId = 0;
  const timers = new Map();
  const microtasks = [];
  const c = vm.createContext({
    console: { error() {}, warn() {}, info() {} },
    Date: { now: () => now }, Math: Object.assign(Object.create(Math), { random: () => 0 }),
    navigator: { onLine: true },
    setTimeout: (fn, delay) => { timers.set(++nextId, { fn, delay }); return nextId; },
    clearTimeout: id => timers.delete(id),
    queueMicrotask: fn => microtasks.push(fn),
    ...extra,
  });
  c.window = { setTimeout: c.setTimeout, clearTimeout: c.clearTimeout, navigator: c.navigator };
  return { c, timers, microtasks, advance: ms => { now += ms; } };
}

function courier(rpc) {
  let requests = 0;
  const h = runtime({
    courierUser: { id: "courier" }, courierProfile: { status: "approved" },
    courierAvailable: true,
    courierOffersPollingDelay: 15000, courierOffersLoadInFlight: null,
    courierOffersLoadPending: false, courierOffersRetryNotBefore: 0,
    courierOffersRetryTimer: null, courierOffersTimer: null,
    courierDeliveryRealtimeStatus: "SUBSCRIBED",
    courierAssignments: [{ assignment_id: "saved", status: "accepted" }],
    courierTargetAssignmentId: "", courierElements: { locationMessage: {} },
    courierEnsureClient: () => ({ rpc: () => { requests++; return rpc(); } }),
    courierSetMessage() {}, courierFriendlyDeliveryError: () => "error",
    courierLogError() {}, courierSyncOfferAlarm() {}, courierRenderDeliveryOffers() {},
    courierRender() {}, courierStopOfferAlarm() {},
  });
  const s = read("colaborador.js");
  vm.runInContext(
    s.slice(
      s.indexOf("function courierActiveAssignment()"),
      s.indexOf("function courierSetStepButtons()")
    ),
    h.c
  );
  vm.runInContext(
    s.slice(
      s.indexOf("function courierOffersPollDelay()"),
      s.indexOf("function courierStopDeliveryRealtime()")
    ),
    h.c
  );
  h.requests = () => requests;
  return h;
}

test("courier 503 preserves data; 100 callers cannot bypass cooldown", async () => {
  const h = courier(async () => ({ data: null, error: { code: "PGRST002" } }));
  const original = h.c.courierAssignments;
  assert.equal(await h.c.courierLoadDeliveryOffers({ silent: true }), false);
  for (let i = 0; i < 100; i++) await h.c.courierLoadDeliveryOffers({ silent: true });
  assert.equal(h.requests(), 1);
  assert.equal(h.c.courierAssignments, original);
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].delay, 30000);
  assert.equal(h.microtasks.length, 0);
});

test("Realtime SUBSCRIBED keeps snapshot retry but never starts periodic polling", async () => {
  const h = courier(async () => ({ data: null, error: { code: "PGRST002" } }));
  assert.equal(await h.c.courierLoadDeliveryOffers({ silent: true }), false);
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].delay, 30000);

  h.c.courierSyncOffersPolling();

  assert.equal(h.timers.size, 1);
  assert.equal(h.c.courierOffersTimer, null);
  assert.ok(h.c.courierOffersRetryTimer);
});

test("concurrent ordinary reads share one request, without an empty extra round", async () => {
  let finish;
  const h = courier(() => new Promise(resolve => { finish = resolve; }));
  const calls = Array.from({ length: 20 }, () => h.c.courierLoadDeliveryOffers({ silent: true }));
  assert.equal(h.requests(), 1);
  finish({ data: [], error: null });
  await Promise.all(calls);
  assert.equal(h.microtasks.length, 0);
  assert.equal(h.timers.size, 0);
});

test("Realtime event during a successful read retains one catch-up", async () => {
  let finish;
  const h = courier(() => new Promise(resolve => { finish = resolve; }));
  const first = h.c.courierLoadDeliveryOffers({ silent: true });
  const second = h.c.courierLoadDeliveryOffers({ silent: true, reconcileAfterInFlight: true });
  finish({ data: [], error: null });
  await Promise.all([first, second]);
  assert.equal(h.microtasks.length, 1);
});

test("Realtime event during a failed read waits instead of immediate retry", async () => {
  let finish;
  const h = courier(() => new Promise(resolve => { finish = resolve; }));
  const first = h.c.courierLoadDeliveryOffers({ silent: true });
  const second = h.c.courierLoadDeliveryOffers({ reconcileAfterInFlight: true });
  finish({ error: { code: "PGRST002" } });
  await Promise.all([first, second]);
  assert.equal(h.microtasks.length, 0);
  assert.equal(h.timers.size, 1);
});

test("backoff grows, is bounded and resets only after a confirmed read", async () => {
  let success = false;
  const h = courier(async () => success ? { data: [], error: null } : { error: { code: "503" } });
  for (const expected of [30000, 60000, 120000, 120000]) {
    await h.c.courierLoadDeliveryOffers({ silent: true });
    assert.equal(h.c.courierOffersPollingDelay, expected);
    h.advance(expected);
  }
  success = true;
  await h.c.courierLoadDeliveryOffers({ silent: true });
  assert.equal(h.c.courierOffersPollingDelay, 15000);
  assert.equal(h.c.courierOffersRetryNotBefore, 0);
  assert.equal(h.timers.size, 0);
});

test("late courier response cannot replace a different user's state", async () => {
  let finish;
  const h = courier(() => new Promise(resolve => { finish = resolve; }));
  const original = h.c.courierAssignments;
  const work = h.c.courierLoadDeliveryOffers({ silent: true });
  h.c.courierUser = { id: "other" };
  finish({ data: [{ assignment_id: "old" }], error: null });
  await work;
  assert.equal(h.c.courierAssignments, original);
});

function central(enabled = true) {
  let removed = 0, callback;
  const channel = { on() { return this; }, subscribe(fn) { callback = fn; } };
  const h = runtime({
    centralOrderRenderTimer: null, centralSyncTimer: null,
    centralRealtimeReconnectTimer: null, centralRealtimeStableTimer: null,
    centralSyncChannel: null, centralSyncStatus: "idle",
    centralSyncInProgress: false, centralSyncRefreshPending: false,
    centralRealtimeNeedsCatchup: false, centralRealtimeReconnectDelay: 1500,
    CENTRAL_REALTIME_RECONNECT_MIN_MS: 1500, CENTRAL_REALTIME_RECONNECT_MAX_MS: 60000,
    CENTRAL_REALTIME_STABLE_MS: 30000, CENTRAL_REALTIME_ENABLED: enabled,
    cloudState: { user: { id: "owner" }, client: {
      channel: () => channel,
      removeChannel: () => { removed++; callback("CLOSED"); return Promise.resolve("ok"); },
      from: () => { throw Error("Unexpected network read"); },
    }},
    handleCentralOrderRealtimePayload() {},
    isTemporarySyncInfrastructureError: error => error?.status === 503,
  });
  const s = read("app.js");
  vm.runInContext(s.slice(s.indexOf("function stopCentralRealtime()"),
    s.indexOf("function scheduleClientOrdersRealtimeReconnect()")), h.c);
  h.status = value => callback(value);
  h.removed = () => removed;
  return h;
}

test("failed central channel is removed once and CLOSED cannot schedule a loop", () => {
  const h = central();
  h.c.startCentralRealtime();
  h.status("CHANNEL_ERROR");
  assert.equal(h.c.centralSyncChannel, null);
  assert.equal(h.removed(), 1);
  assert.equal(h.timers.size, 1);
  assert.equal(h.c.centralRealtimeNeedsCatchup, true);
});

test("disabled central Realtime creates neither a channel nor a refresh/reconnect timer", () => {
  const h = central(false);
  h.c.startCentralRealtime();
  h.c.scheduleCentralRefresh({ orders: true });
  h.c.deferCentralRefreshAfterError({ status: 503 }, { orders: true });
  assert.equal(h.c.centralSyncChannel, null);
  assert.equal(h.removed(), 0);
  assert.equal(h.timers.size, 0);
});

test("central 503 gates direct and scheduled requests while retaining scopes", async () => {
  const h = central();
  h.c.deferCentralRefreshAfterError({ status: 503 }, { orders: true });
  for (let i = 0; i < 100; i++) {
    assert.equal(await h.c.refreshCentralCloudState({ settings: true, profile: false, orders: false }), false);
  }
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].delay, 30000);
  assert.equal(vm.runInContext("centralSyncRequestedScopes.settings && centralSyncRequestedScopes.orders", h.c), true);
});
