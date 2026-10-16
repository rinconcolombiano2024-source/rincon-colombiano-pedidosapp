import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('SumUp checkout rejects missing or short public tokens before order lookup', () => {
  const source = readFileSync('supabase/functions/sumup-checkout/index.ts', 'utf8');
  const check = source.indexOf('publicToken.length<8');
  const lookup = source.indexOf('admin.from("customer_orders")');
  assert.ok(check > 0 && check < lookup, 'token shape validated before database read');
});
