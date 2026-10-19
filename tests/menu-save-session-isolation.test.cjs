const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

for (const file of ['app.js', 'www/app.js']) {
  const source = readFileSync(file, 'utf8');
  const now = source.slice(source.indexOf('async function saveMenuWhenPossibleNow('), source.indexOf('async function publishCurrentRestaurantMenu('));
  const queue = source.slice(source.indexOf('// One in-flight save per restaurant,'), source.indexOf('function readCurrencySymbol('));
  function harness() {
    const state = { client: {}, user: { id: 'A' } };
    const effects = [];
    let resolve, reject, releaseQueue;
    const operation = new Promise((a, b) => { resolve = a; reject = b; });
    const ctx = vm.createContext({ cloudState: state, navigator: { onLine: true },
      console: { error() {} }, menuSaveQueue: Promise.resolve(),
      currentMenuPendingToken: () => 'pending-A',
      clearMenuPending: () => { effects.push('clear'); return true; },
      markMenuPending: () => effects.push('mark'),
      updateCloudStatus: s => effects.push(s), shouldQueueForCloud: () => true,
      hasPendingMenu: () => false, withCloudTimeout: p => p,
      saveCloudMenu: () => { effects.push('write'); return operation; },
    });
    vm.runInContext(now + queue, ctx);
    return { state, ctx, effects, resolve, reject,
      delayQueue() { ctx.menuSaveQueue = new Promise(r => { releaseQueue = r; }); },
      releaseQueue() { releaseQueue(); },
    };
  }
  for (const change of ['owner', 'client', 'logout']) {
    for (const outcome of ['success', 'failure']) {
      test(`${file}: late menu ${outcome} cannot alter next session (${change})`, async () => {
        const h = harness();
        const pending = h.ctx.saveMenuWhenPossibleNow();
        h.effects.length = 0;
        if (change === 'owner') h.state.user = { id: 'B' };
        if (change === 'client') h.state.client = {};
        if (change === 'logout') h.state.user = null;
        if (outcome === 'success') h.resolve({ localChangesPending: false });
        else h.reject(new Error('network failure'));
        const result = await pending;
        assert.deepEqual(h.effects, [], 'no pending token or status mutation in another session');
        assert.notEqual(result.synced, true);
        assert.equal(result.pending, false);
      });
    }
  }
  test(`${file}: queued menu save cannot start for a different restaurant`, async () => {
    const h = harness(); h.delayQueue();
    const pending = h.ctx.saveMenuWhenPossible();
    h.state.user = { id: 'B' }; h.releaseQueue(); h.resolve({});
    const result = await pending;
    assert.deepEqual(h.effects, []);
    assert.notEqual(result.synced, true);
    assert.equal(result.pending, false);
  });
  test(`${file}: same-session publication still clears its token`, async () => {
    const h = harness(); const pending = h.ctx.saveMenuWhenPossibleNow();
    h.resolve({ localChangesPending: false });
    assert.equal((await pending).synced, true);
    assert.ok(h.effects.includes('clear')); assert.ok(h.effects.includes('Sincronizado'));
  });
  test(`${file}: same-session network failure remains pending without retry`, async () => {
    const h = harness(); const pending = h.ctx.saveMenuWhenPossibleNow();
    h.reject(new Error('offline'));
    assert.equal((await pending).pending, true);
    assert.equal(h.effects.filter(s => s === 'write').length, 1);
    assert.ok(h.effects.includes('mark'));
  });
}
