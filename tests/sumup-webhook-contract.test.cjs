'use strict';
// Regression contract: incoming SumUp callback JSON is never proof of payment.
// This test is intentionally dependency-free and does not contact providers or DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const webhook = fs.readFileSync(path.join(root, 'supabase/functions/sumup-webhook/index.ts'), 'utf8');
const inspector = fs.readFileSync(path.join(root, 'supabase/functions/_shared/sumup-webhook.ts'), 'utf8');

test('SumUp webhook is disabled unless explicitly enabled', () => {
  assert.match(webhook, /RC_SUMUP_PAYMENTS_ENABLED/);
  assert.match(webhook, /!==\s*"1"/);
});

test('SumUp webhook obtains authoritative checkout state from provider', () => {
  assert.match(inspector, /retrieveSumUpCheckout\s*\(/);
  assert.match(webhook, /inspectSumUpWebhook\s*\(/);
  assert.match(webhook, /p_provider_status\s*:\s*inspected\.providerStatus/);
  assert.doesNotMatch(webhook, /p_provider_status\s*:\s*(?:raw|event)\./);
});

test('SumUp webhook binds callback to persisted attempt and merchant', () => {
  assert.match(webhook, /rc_sumup_payment_attempts/);
  assert.match(webhook, /\.eq\("checkout_id",event\.checkoutId\)/);
  assert.match(webhook, /row\.restaurant_user_id\s*!==\s*restaurantId/);
  assert.match(webhook, /row\.merchant_code\s*!==\s*merchantCode/);
});

test('SumUp webhook uses transactional ledger RPC rather than direct paid update', () => {
  assert.match(webhook, /admin\.rpc\("rc_sumup_apply_verified_checkout"/);
  assert.doesNotMatch(webhook, /\.from\("(?:orders|rc_orders|rc_sumup_payment_attempts)"\)\s*\.update\(/);
});
