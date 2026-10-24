'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const file of ['app.js', 'www/app.js']) {
  test(file + ': an offline order snapshot must not count as successful catch-up', async () => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const start = source.indexOf('async function performClientOrdersRefresh(options = {}) {');
    const end = source.indexOf('function clientOrderItems(', start);
    assert.ok(start >= 0 && end > start, 'customer orders snapshot function exists');

    let requests = 0;
    const existing = [{ id: 'pending-order', status: 'pending' }];
    const context = vm.createContext({
      cloudState: {
        client: { from() { requests += 1; throw new Error('offline request attempted'); } },
        user: { id: 'restaurant-test' },
      },
      pendingClientOrders: existing,
      canUseCustomerModule: () => true,
      navigator: { onLine: false },
      elements: {
        clientOrdersDialog: { open: false },
        clientOrdersList: { innerHTML: '' },
      },
    });
    vm.runInContext(source.slice(start, end), context, { filename: file });
    const recovered = await context.performClientOrdersRefresh({ silent: true });

    assert.equal(recovered, false, 'offline refresh must not acknowledge recovery');
    assert.equal(requests, 0, 'offline refresh should not call Supabase');
    assert.equal(context.pendingClientOrders[0].id, existing[0].id, 'pending orders survive offline');
  });
}
