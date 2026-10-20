import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../MIGRACION-V91-77-DAILY-CLOSE-READINESS.sql",import.meta.url),"utf8");
test("readiness check scopes orders to authenticated owner and business date",()=>{assert.match(sql,/auth\\.uid\\(\\)/);assert.match(sql,/o\\.user_id = v_user and o\\.business_date = p_business_date/);});
test("open orders, missing payment confirmation and method are blockers",()=>{for(const token of ["ORDER_NOT_FINISHED","PAYMENT_NOT_CONFIRMED","PAYMENT_METHOD_MISSING"])assert.ok(sql.includes(token));});
test("readiness check does not alter payment or close orders",()=>{assert.doesNotMatch(sql,/\\b(update|delete|truncate|drop)\\s+(?:table\\s+)?public\\.orders\\b/i);assert.match(sql,/security invoker/);});
