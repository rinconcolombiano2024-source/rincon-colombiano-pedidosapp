import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';

// Authenticated financial requests must not follow 30x responses. Even if the
// provider applied a POST before redirecting, the outcome must remain uncertain
// until idempotent provider-side reconciliation.
const routes = [
  'supabase/functions/marketplace-webhook/index.ts',
  'supabase/functions/marketplace-refund-reversals/index.ts',
  'supabase/functions/marketplace-settlement/index.ts',
  'supabase/functions/marketplace-checkout/index.ts',
  'supabase/functions/marketplace-release-order/index.ts',
  'supabase/functions/marketplace-cancel-order/index.ts',
];

for (const path of routes) {
  test(`financial route forbids redirect-following: ${path}`, () => {
    const source = readFileSync(path, 'utf8');
    const calls = [...source.matchAll(/\bfetch\s*\(/g)];
    assert.equal(calls.length, 1, 'Review this check if adding new HTTP calls');
    const next = source.slice(calls[0].index, calls[0].index + 1200);
    assert.match(next, /redirect:\s*["']error["']/, 'Authenticated fetch must reject redirects');
    assert.match(next, /\bsignal\s*:/, 'Financial request must retain timeout or abort signal');
  });
}

test('a 307 cannot replay an authenticated POST into an unexpected route', async () => {
  const requests = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    requests.push({url: req.url, method: req.method, authorization: req.headers.authorization, raw});
    if (req.url === '/stripe-transfer') {
      res.writeHead(307, {'location': '/unexpected-target'});
      res.end();
    } else {
      res.writeHead(200);
      res.end('unintended second POST');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/stripe-transfer`;
    await assert.rejects(
      fetch(url, {
        method: 'POST', redirect: 'error',
        headers: {'authorization': 'Bearer test-only-secret'},
        body: JSON.stringify({amount:1000}), signal:AbortSignal.timeout(2000),
      }),
      TypeError,
    );
    assert.deepEqual(requests.map(x => x.url), ['/stripe-transfer']);
    assert.equal(requests[0].authorization, 'Bearer test-only-secret');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
