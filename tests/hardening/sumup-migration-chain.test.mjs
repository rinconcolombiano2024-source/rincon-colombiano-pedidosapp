import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const base = read('MIGRACION-V91-73-SUMUP-SINGLE-MERCHANT-LEDGER.sql');
const compat = [
 'supabase/migrations/20261013055141_sumup_hosted_checkout_url_compat.sql',
 'supabase/migrations/20261013055623_sumup_order_provider_compat.sql',
 'supabase/migrations/20261013060200_sumup_cross_provider_reservation_guard.sql'
];
test('SumUp baseline ledger contains all server-side checkout RPCs', () => {
 for (const name of ['rc_sumup_reserve_checkout','rc_sumup_commit_checkout','rc_sumup_apply_verified_checkout']) {
   assert.match(base, new RegExp('CREATE OR REPLACE FUNCTION public\\.' + name + '\\s*\\('));
 }
 assert.match(base,/CREATE TABLE IF NOT EXISTS public\.rc_sumup_payment_attempts/);
 assert.match(base,/ENABLE ROW LEVEL SECURITY/);
 assert.match(base,/SUMUP_RECONCILIATION_REQUIRED/);
});
test('SumUp migrations have explicit baseline checks and fail closed', () => {
 for (const file of compat) {
   const sql = read(file);
   assert.match(sql,/BEGIN;/);
   assert.match(sql,/COMMIT;/);
   assert.match(sql,/RAISE EXCEPTION/);
 }
});
test('no payment feature flag is enabled by SQL migrations', () => {
 for (const file of ['MIGRACION-V91-73-SUMUP-SINGLE-MERCHANT-LEDGER.sql',...compat]) {
   assert.doesNotMatch(read(file),/RC_SUMUP_PAYMENTS_ENABLED\s*=\s*['"]?1/i);
 }
});
