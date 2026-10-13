import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";

const db=new PGlite(),owner=randomUUID(),stranger=randomUUID(),customer=randomUUID();
await db.exec(`
 create role authenticated;create role anon;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table app_settings(user_id uuid primary key,settings jsonb);
 create table orders(id uuid primary key,user_id uuid);
 create table customer_orders(id uuid primary key,user_id uuid,customer_user_id uuid,created_by_user_id uuid);
 insert into app_settings values ('${owner}','{}');
 insert into orders values (gen_random_uuid(),'${owner}');
 insert into customer_orders values (gen_random_uuid(),'${owner}','${customer}','${owner}');
 grant usage on schema public,auth to authenticated;
 grant select,update,insert,delete on app_settings,orders,customer_orders to authenticated;
 alter table app_settings enable row level security;
 alter table orders enable row level security;
 alter table customer_orders enable row level security;
 create policy "Users manage own app settings" on app_settings as permissive for all to authenticated
  using (auth.uid()=user_id) with check (auth.uid()=user_id);
 create policy "Users manage own orders" on orders as permissive for all to authenticated
  using (auth.uid()=user_id) with check (auth.uid()=user_id);
 create policy "Restaurants read own customer orders" on customer_orders as permissive for select to authenticated
  using (auth.uid()=user_id);
 create policy "Authenticated customers read own customer orders" on customer_orders as permissive for select to authenticated
  using (auth.uid()=customer_user_id);
 create policy "Staff read submitted station orders" on customer_orders as permissive for select to authenticated
  using (auth.uid()=created_by_user_id);
`);
test.after(()=>db.close());
async function accessFor(id){
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 await db.exec("set role authenticated");
 try{
  const result=await db.query(`select
   (select count(*)::int from app_settings) app,
   (select count(*)::int from orders) orders,
   (select count(*)::int from customer_orders) customer`);
  return result.rows[0];
 } finally {await db.exec("reset role");}
}
test("R17 five RLS policies preserve both authorized and stranger reads",async()=>{
 const before=await Promise.all([accessFor(owner),accessFor(customer),accessFor(stranger)]);
 assert.deepEqual(before.map(x=>[x.app,x.orders,x.customer]),[[1,1,1],[0,0,1],[0,0,0]]);
 await db.exec(readFileSync("MIGRACION-V91-72-CPU-RLS-INITPLAN.sql","utf8"));
 const after=await Promise.all([accessFor(owner),accessFor(customer),accessFor(stranger)]);
 assert.deepEqual(after,before);
 const policies=await db.query("select count(*)::int n from pg_policies where qual like '%(SELECT auth.uid())%'");
 assert.equal(policies.rows[0].n,5);
});
