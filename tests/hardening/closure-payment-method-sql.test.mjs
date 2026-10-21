import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("MIGRACION-V91-72-CIERRE-METODO-PAGO-OBLIGATORIO.sql","utf8");
test("closure payment guard is additive, scoped by tenant and business dates",()=>{
 assert.match(sql,/pg_get_functiondef\('public\.close_current_restaurant_period\(text,date\)'::regprocedure\)/);
 assert.match(sql,/o\.user_id = v_owner_id/);
 assert.match(sql,/o\.business_date >= v_start_date and o\.business_date < v_end_date/);
 assert.match(sql,/RC_ORDERA_CLOSURE_PAYMENT_METHOD_REQUIRED/);
 assert.match(sql,/v91_25_single_report/);
 assert.doesNotMatch(sql,/drop\s+(table|function)|truncate\s+|delete\s+from/i);
});
