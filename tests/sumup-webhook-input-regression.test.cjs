'use strict';
// Fail-closed webhook input contract. No network calls or payment mutations.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/sumup-webhook/index.ts'), 'utf8');
const parser = fs.readFileSync(path.join(__dirname, '../supabase/functions/_shared/sumup-webhook.ts'), 'utf8');

test('webhook accepts POST only and refuses missing merchant configuration', () => {
  assert.match(source, /req\.method\s*!==\s*"POST"/);
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUMUP_API_KEY', 'SUMUP_MERCHANT_CODE', 'APP_BASE_URL', 'RC_SUMUP_RESTAURANT_USER_ID']) {
    assert.ok(source.includes(name), 'missing configuration gate: ' + name);
  }
  assert.match(source, /!UUID\.test\(restaurantId\)/);
});
test('webhook enforces byte limit on both advertised and streamed payload', () => {
  assert.match(source, /content-length"[)]\|\|0\)>4096/);
  assert.match(source, /size\s*>\s*4096/);
  assert.match(source, /reader\.cancel\(\)/);
  assert.match(source, /JSON\.parse\(new TextDecoder\(\)\.decode\(bytes\)\)/);
});
test('invalid callback JSON or checkout ID fails closed', () => {
  assert.match(source, /event=parseSumUpWebhookEvent\(raw\)/);
  assert.match(parser, /SUMUP_WEBHOOK_INVALID_ID/);
  assert.match(parser, /CHECKOUT_STATUS_CHANGED/);
  assert.match(source, /catch\s*\{return answer\(400\);\}/);
});
test('untrusted, cross-merchant and already-paid callbacks cannot create another payment', () => {
  assert.match(source, /if\(!row\)return answer\(204\)/);
  assert.match(source, /row\.restaurant_user_id!==restaurantId/);
  assert.match(source, /row\.merchant_code!==merchantCode/);
  assert.match(source, /row\.status==="paid"\)return answer\(204\)/);
  assert.match(source, /if\(saved\.error \|\| !saved\.data\)return answer\(503\)/);
});
