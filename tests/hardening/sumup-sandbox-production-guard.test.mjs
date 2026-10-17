import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression guard: installing a sandbox credential must never silently enable
// payment processing on the production Supabase project.
for (const name of ['sumup-checkout', 'sumup-webhook']) {
  test(name + ': production payment gate remains explicit', () => {
    const source = readFileSync('supabase/functions/' + name + '/index.ts', 'utf8');
    assert.match(source, /Deno\.env\.get\("RC_SUMUP_PAYMENTS_ENABLED"\)\s*!==\s*"1"/);
    assert.match(source, /Deno\.env\.get\("SUMUP_API_KEY"\)/);
    assert.doesNotMatch(source, /Deno\.env\.get\("SUMUP_SANDBOX_API_KEY"\)/);
    assert.match(source, /Deno\.env\.get\("SUMUP_MERCHANT_CODE"\)/);
    assert.match(source, /Deno\.env\.get\("RC_SUMUP_RESTAURANT_USER_ID"\)/);
  });
}
test('SumUp webhook checks provider checkout rather than trusting event status', () => {
  const source = readFileSync('supabase/functions/_shared/sumup-webhook.ts', 'utf8');
  assert.match(source, /retrieveSumUpCheckout\(/);
  assert.doesNotMatch(source, /raw\.status\s*===\s*['"]PAID['"]/);
});
test('SumUp checkout does not accept browser-controlled amount or merchant', () => {
  const source = readFileSync('supabase/functions/sumup-checkout/index.ts', 'utf8');
  assert.match(source, /rc_sumup_reserve_checkout/);
  assert.match(source, /amountMinor:Number\(attempt\.amountMinor\)/);
  assert.doesNotMatch(source, /amountMinor:\s*Number\(body\./);
  assert.doesNotMatch(source, /merchantCode:\s*body\./);
});
