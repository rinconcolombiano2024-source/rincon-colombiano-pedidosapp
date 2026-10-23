import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("MIGRACION-V91-76-INVENTORY-SERVICE-TRANSACTIONS.sql","utf8");
test("inventory RPCs require service-role and never expose direct client execution",()=>{
 for(const name of ["receive","issue"]){
  assert.match(sql,new RegExp("create or replace function public\\.rc_inventory_"+name+"\\("));
  assert.match(sql,new RegExp("revoke all on function public\\.rc_inventory_"+name+"\\([\\s\\S]+?from public,anon,authenticated"));
  assert.match(sql,new RegExp("grant execute on function public\\.rc_inventory_"+name+"\\([\\s\\S]+?to service_role"));
 }
 assert.match(sql,/security invoker/i);
 assert.doesNotMatch(sql,/security definer/i);
});
test("FIFO updates and movements are atomic and restaurant-scoped",()=>{
 assert.match(sql,/for v_lot in select \* from public\.rc_inventory_lots[\s\S]*?order by received_at,id for update/i);
 assert.match(sql,/update public\.rc_inventory_lots set available_milli=available_milli-v_take/);
 assert.match(sql,/if v_remaining>0 then raise exception 'INSUFFICIENT_STOCK'/);
 assert.match(sql,/restaurant_id=p_restaurant and warehouse_id=p_warehouse/);
 assert.match(sql,/pg_advisory_xact_lock/);
});
test("idempotency keys reject ambiguous namespaces and verify request payload",()=>{
 assert.match(sql,/position\(':' in p_idempotency_key\)>0/g);
 assert.match(sql,/IDEMPOTENCY_CONFLICT/g);
 assert.match(sql,/left\(idempotency_key,length\(p_idempotency_key\)\+1\)=p_idempotency_key\|\|':'/);
});
test("SQL migration contains no destructive schema statements or order/payment changes",()=>{
 assert.doesNotMatch(sql,/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i);
 assert.doesNotMatch(sql,/\b(stripe|sumup|payments|pedidos)\b/i);
 assert.match(sql,/^begin;/m);assert.match(sql,/commit;\s*$/);
});
