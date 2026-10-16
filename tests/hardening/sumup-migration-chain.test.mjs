import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const baseline = 'MIGRACION-V91-73-SUMUP-SINGLE-MERCHANT-LEDGER.sql';
const preflight = 'scripts/sumup-readiness-preflight.sql';
const compat = [
 'supabase/migrations/20261013055141_sumup_hosted_checkout_url_compat.sql',
 'supabase/migrations/20261013055623_sumup_order_provider_compat.sql',
 'supabase/migrations/20261013060200_sumup_cross_provider_reservation_guard.sql'
];

test('baseline ledger defines the three server-only payment procedures', () => {
 const sql = read(baseline);
 for (const name of ['rc_sumup_reserve_checkout','rc_sumup_commit_checkout','rc_sumup_apply_verified_checkout']) {
   assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.' + name + '('), name);
   assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.' + name), name + ' must revoke public access');
 }
 assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.rc_sumup_payment_attempts'));
 assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));
 assert.ok(sql.includes('SUMUP_RECONCILIATION_REQUIRED'));
});

test('preflight remains read-only and checks dependencies', () => {
 const sql = read(preflight);
 assert.ok(sql.includes('rc_sumup_payment_attempts'));
 assert.ok(sql.includes('rc_sumup_apply_verified_checkout'));
 assert.doesNotMatch(sql,/^\s*(?:CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE|GRANT|REVOKE)\s/mi);
});

test('compatibility migrations cannot be assumed installed merely because PR exists', t => {
 const missing = compat.filter(path => !existsSync(path));
 if (missing.length) {
   t.diagnostic('Not on this branch: ' + missing.join(', ') + '. Do not enable payments.');
   return;
 }
 for (const file of compat) {
   const sql = read(file);
   assert.match(sql,/BEGIN;/);
   assert.match(sql,/COMMIT;/);
   assert.match(sql,/RAISE EXCEPTION/);
 }
});

test('baseline never activates real payments', () => {
 assert.doesNotMatch(read(baseline),/RC_SUMUP_PAYMENTS_ENABLED\s*=\s*['"]?1/i);
});
