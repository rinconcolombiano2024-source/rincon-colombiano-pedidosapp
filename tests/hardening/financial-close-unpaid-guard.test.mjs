import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../MIGRACION-V91-71-CIERRE-BLOQUEO-PAGOS-PENDIENTES.sql",import.meta.url),"utf8");
test("close RPC requires authenticated owner and period-scoped unpaid guard",()=>{
  assert.match(sql,/v_owner_id uuid := auth\.uid\(\)/);
  assert.match(sql,/o\.user_id = v_owner_id/);
  assert.match(sql,/o\.business_date >= v_start_date and o\.business_date < v_end_date/);
  assert.match(sql,/o\.order_json->>'paymentMethod'/);
  assert.match(sql,/o\.order_json->>'paymentStatus'/);
  assert.match(sql,/<> 'paid'/);
  assert.match(sql,/not in \('cancelled', 'rejected'\)/);
  assert.match(sql,/in preparation/);
  assert.match(sql,/raise exception using errcode = 'P0001'/);
  assert.ok(sql.indexOf("if exists (")<sql.indexOf("return query"));
});
test("migration does not rewrite or delete historical orders",()=>{
  assert.doesNotMatch(sql,/\b(?:update|delete from|truncate)\s+public\.orders\b/i);
  assert.match(sql,/create or replace function public\.close_current_restaurant_period/i);
  assert.match(sql,/public\.get_restaurant_closure_report/);
  assert.match(sql,/insert into public\.restaurant_period_closures/);
});
