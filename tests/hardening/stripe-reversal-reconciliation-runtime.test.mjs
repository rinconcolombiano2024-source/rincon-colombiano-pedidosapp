import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { webcrypto } from 'node:crypto';

const jobId = '00000000-0000-4000-8000-000000000001';
const paymentId = '00000000-0000-4000-8000-000000000002';
const lease = '00000000-0000-4000-8000-000000000003';
const transferId = 'tr_fixture';
const reversal = (id, metadata = {}) => ({ id, object: 'transfer_reversal', transfer: transferId,
  amount: 1000, currency: 'pln', metadata, created: 1 });
const matching = reversal('trr_existing', { rc_ordera_reversal_id: jobId, payment_transaction_id: paymentId });
const page = (data = [], has_more = false) => ({ object: 'list', data, has_more });

function harness(options = {}) {
  let handler, pageIndex = 0;
  const calls = [], finishes = [];
  const env = { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only', STRIPE_SECRET_KEY: 'sk_test_fixture' };
  const admin = { rpc: async (name, args) => {
    if (name === 'rc_ordera_claim_refund_reversals') return { data: [{ id: jobId, payment_transaction_id: paymentId,
      transfer_id: transferId, expected_amount_minor: 1000, currency: 'PLN', status: 'processing', attempts: 1, lease_token: lease }] };
    if (name === 'rc_ordera_reserve_refund_reversal_amount') return { data: 1000 };
    if (name === 'rc_ordera_finish_refund_reversal') { finishes.push(args); return { data: true }; }
    throw Error('Unexpected RPC: ' + name);
  } };
  const ctx = vm.createContext({ Request, Response, URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array,
    AbortController, DOMException, setTimeout, clearTimeout, crypto: webcrypto, console,
    Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn; } }, createClient: () => admin,
    fetch: async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers });
      if (url.includes('/reversals?')) {
        const data = options.pages ? options.pages[pageIndex++] : page();
        return new Response(JSON.stringify(data), { status: options.listStatus ?? 200 });
      }
      if (init.method === 'POST') return new Response(JSON.stringify(matching), { status: options.createStatus ?? 200 });
      return new Response(JSON.stringify({ id: transferId, object: 'transfer', amount: 1000, currency: 'pln',
        amount_reversed: 0, ...options.transfer }), { status: options.transferStatus ?? 200 });
    },
  });
  const source = readFileSync('supabase/functions/marketplace-refund-reversals/index.ts', 'utf8').replace(/^import .*;\n/gm, '');
  vm.runInContext(stripTypeScriptTypes(source), ctx);
  return { calls, finishes, run: async () => {
    const response = await handler(new Request('https://fixture.test/refund', { method: 'POST',
      headers: { authorization: 'Bearer test-only', 'content-type': 'application/json' }, body: '{}' }));
    assert.equal(response.status, 200); return response.json();
  } };
}

test('complete empty history allows one idempotent reversal', async () => {
  const h = harness(); assert.equal((await h.run()).confirmed, 1);
  const writes = h.calls.filter(c => c.method === 'POST'); assert.equal(writes.length, 1);
  assert.equal(writes[0].headers['Idempotency-Key'], `rc-refund-reversal:${jobId}`);
});
test('existing reversal on second page is reconciled without a POST', async () => {
  const h = harness({ pages: [page([reversal('trr_other')], true), page([matching])], transfer: { amount_reversed: 1000 } });
  assert.equal((await h.run()).confirmed, 1);
  assert.equal(h.calls.filter(c => c.method === 'POST').length, 0);
  assert.ok(h.calls.some(c => c.url.includes('starting_after=trr_other')));
  assert.equal(h.finishes[0].p_reversal_id, 'trr_existing');
});
for (const [name, value] of Object.entries({ null: null, missingData: { object: 'list', has_more: false },
  missingPagination: { object: 'list', data: [] }, wrongObject: { object: 'transfer', data: [], has_more: false },
  emptyMore: page([], true), foreignTransfer: page([{ ...matching, transfer: 'tr_other' }]),
  invalidEntry: page([null]), duplicateId: page([matching, matching]) })) {
  test(`invalid history (${name}) never permits a reversal`, async () => {
    const h = harness({ pages: [value] }); const result = await h.run();
    assert.equal(h.calls.filter(c => c.method === 'POST').length, 0);
    assert.equal(result.confirmed, 0); assert.equal(result.manualReview, 1);
  });
}
test('repeated cursor cannot loop or authorize a POST', async () => {
  const h = harness({ pages: [page([reversal('trr_repeat')], true), page([reversal('trr_repeat')], true)] });
  assert.equal((await h.run()).manualReview, 1);
  assert.equal(h.calls.filter(c => c.method === 'POST').length, 0);
  assert.equal(h.calls.filter(c => c.url.includes('/reversals?')).length, 2);
});
test('history traversal is bounded and incomplete history requires review', async () => {
  const h = harness({ pages: Array.from({ length: 10 }, (_, i) => page([reversal('trr_page' + i)], true)) });
  assert.equal((await h.run()).manualReview, 1);
  assert.equal(h.calls.filter(c => c.url.includes('/reversals?')).length, 5);
  assert.equal(h.calls.filter(c => c.method === 'POST').length, 0);
});
for (const status of [202, 206]) for (const stage of ['transfer', 'list', 'create']) {
  test(`${stage} HTTP ${status} cannot confirm a reversal`, async () => {
    const h = harness({ [stage + 'Status']: status }); const result = await h.run();
    assert.equal(result.confirmed, 0);
    if (stage !== 'create') assert.equal(h.calls.filter(c => c.method === 'POST').length, 0);
    assert.ok(h.finishes.every(f => f.p_status !== 'confirmed'));
  });
}
for (const value of [null, '0', -1, 1.5, 1001]) test(`invalid reversed amount ${JSON.stringify(value)} blocks money movement`, async () => {
  const h = harness({ transfer: { amount_reversed: value } });
  assert.equal((await h.run()).manualReview, 1);
  assert.equal(h.calls.filter(c => c.method === 'POST').length, 0);
});
