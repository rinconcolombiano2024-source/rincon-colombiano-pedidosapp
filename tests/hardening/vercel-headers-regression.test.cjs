'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vercel.json'), 'utf8'));
const rules = config.headers || [];
const headersFor = source => Object.fromEntries(
  (rules.find(rule => rule.source === source)?.headers || []).map(({ key, value }) => [key.toLowerCase(), value])
);

test('all routes deny framing and MIME sniffing', () => {
  const h = headersFor('/(.*)');
  assert.equal(h['x-frame-options'], 'SAMEORIGIN');
  assert.equal(h['x-content-type-options'], 'nosniff');
  assert.match(h['content-security-policy'], /object-src 'none'/);
  assert.match(h['content-security-policy'], /frame-ancestors 'self'/);
});

test('service worker is always revalidated', () => {
  const h = headersFor('/service-worker.js');
  assert.match(h['cache-control'], /max-age=0/);
  assert.match(h['cache-control'], /must-revalidate/);
});

test('HTML responses are not served with stale cache policy', () => {
  const h = headersFor('/(.*).html');
  assert.match(h['cache-control'], /must-revalidate/);
  assert.equal(h['x-content-type-options'], 'nosniff');
});
