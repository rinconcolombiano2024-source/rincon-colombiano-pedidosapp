const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/marketplace-onboarding/index.ts'), 'utf8');
const start = source.indexOf('async function stripeRequest(');
const end = source.indexOf('\nasync function stripePost(', start);
assert.ok(start >= 0 && end > start);
const javascript = stripTypeScriptTypes(source.slice(start, end), { mode: 'strip' });

function helper(fetchImpl) {
  const timers = new Map(); let id = 0;
  const context = { AbortController, DOMException, fetch: fetchImpl,
    STRIPE_REQUEST_TIMEOUT_MS: 15000,
    setTimeout(callback, ms) { assert.equal(ms, 15000); const key = ++id; timers.set(key, callback); return key; },
    clearTimeout(key) { timers.delete(key); } };
  vm.createContext(context); vm.runInContext(javascript, context);
  return { request: context.stripeRequest, timers };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('deadline remains active after headers and until the full body arrives', async () => {
  let finish;
  const h = helper(async () => ({ ok: true, text: () => new Promise(resolve => { finish = resolve; }) }));
  const request = h.request('https://stripe.test', {}); await tick();
  assert.equal(h.timers.size, 1);
  finish('{"id":"acct_test"}'); const result = await request;
  assert.equal(result.id, 'acct_test'); assert.equal(h.timers.size, 0);
});
test('body aborted after headers reports timeout and cleans timer', async () => {
  const h = helper(async (_url, options) => ({ ok: true,
    text: () => new Promise((_, reject) => options.signal.addEventListener('abort',
      () => reject(new DOMException('Aborted body', 'AbortError')), { once: true })) }));
  const request = h.request('https://stripe.test', {});
  const expected = assert.rejects(request, /STRIPE_TIMEOUT/);
  await tick(); [...h.timers.values()][0](); await expected;
  assert.equal(h.timers.size, 0);
});
test('headers aborted report timeout', async () => {
  const h = helper((_url, options) => new Promise((_, reject) => options.signal.addEventListener('abort',
    () => reject(new DOMException('Aborted request', 'AbortError')), { once: true })));
  const expected = assert.rejects(h.request('https://stripe.test', {}), /STRIPE_TIMEOUT/);
  [...h.timers.values()][0](); await expected; assert.equal(h.timers.size, 0);
});
test('invalid JSON and provider rejection preserve failure contracts', async () => {
  for (const [response, code] of [[{ ok: true, text: async () => 'not-json' }, 'STRIPE_INVALID_RESPONSE'],
    [{ ok: false, text: async () => '{}' }, 'STRIPE_REQUEST_FAILED']]) {
    const h = helper(async () => response);
    await assert.rejects(h.request('https://stripe.test', {}), new RegExp(code)); assert.equal(h.timers.size, 0);
  }
});
test('transport errors never trigger a second request', async () => {
  let calls = 0;
  const h = helper(async () => { calls++; throw new Error('Network lost'); });
  await assert.rejects(h.request('https://stripe.test', {}), /STRIPE_UNREACHABLE/);
  assert.equal(calls, 1); assert.equal(h.timers.size, 0);
});
