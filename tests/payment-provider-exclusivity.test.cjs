"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const root = join(__dirname, "..");
const read = p => readFileSync(join(root,p),"utf8");

test("Stripe and SumUp API gateways reject a different previously reserved provider", () => {
  const stripe = read("supabase/functions/marketplace-checkout/index.ts");
  const sumup = read("supabase/functions/sumup-checkout/index.ts");
  assert.match(stripe, /payment_status,payment_provider,order_json/);
  assert.match(stripe, /existingProvider !== "stripe_connect"/);
  assert.match(stripe, /Order is reserved for another payment provider/);
  assert.match(sumup, /payment_method,payment_provider,currency/);
  assert.match(sumup, /existingProvider!=="sumup"/);
  assert.match(sumup, /ORDER_RESERVED_FOR_OTHER_PAYMENT_PROVIDER/);
});

test("SumUp database reservation binds provider ownership in the order transaction", () => {
  const sql = read("MIGRACION-V91-73-SUMUP-SINGLE-MERCHANT-LEDGER.sql");
  const reserve = sql.split("CREATE OR REPLACE FUNCTION public.rc_sumup_reserve_checkout(")[1]
    .split("CREATE OR REPLACE FUNCTION public.rc_sumup_commit_checkout(")[0];
  assert.match(reserve, /FROM public.customer_orders[\s\S]*?FOR UPDATE/);
  assert.match(reserve, /payment_provider='sumup'/);
  assert.match(reserve, /SUMUP_PROVIDER_SWITCH_FORBIDDEN/);
  assert.match(reserve, /SUMUP_OTHER_PROVIDER_RECONCILIATION_REQUIRED/);
});

test("SumUp checkout commit and verified payment detect order amount drift", () => {
  const sql = read("MIGRACION-V91-73-SUMUP-SINGLE-MERCHANT-LEDGER.sql");
  const commit = sql.split("CREATE OR REPLACE FUNCTION public.rc_sumup_commit_checkout(")[1]
    .split("CREATE OR REPLACE FUNCTION public.rc_sumup_apply_verified_checkout(")[0];
  const apply = sql.split("CREATE OR REPLACE FUNCTION public.rc_sumup_apply_verified_checkout(")[1]
    .split("CREATE OR REPLACE FUNCTION public.rc_sumup_guard_customer_cancel(")[0];
  assert.match(commit, /o\.total\*100 <> a\.amount_minor/);
  assert.match(apply, /o\.total\*100 <> a\.amount_minor/);
  assert.match(apply, /'reason','AMOUNT_DRIFT'/);
  assert.match(apply, /status='needs_review'/);
});
