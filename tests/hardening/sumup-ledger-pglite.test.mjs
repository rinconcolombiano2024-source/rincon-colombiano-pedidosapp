import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {pgcrypto} from "@electric-sql/pglite/contrib/pgcrypto";

const db = new PGlite({extensions:{pgcrypto}});
const merchantId=randomUUID(),otherId=randomUUID(),orderId=randomUUID();
const checkoutId=randomUUID();
await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create extension pgcrypto;
 create table public.customer_orders(
  id uuid primary key,user_id uuid not null,status text not null,
  canonical_status text not null default 'created',payment_method text not null,
  payment_status text not null,payment_provider text not null default '',
  payment_amount numeric not null default 0,payment_currency text not null default '',
  provider_reference text not null default '',paid_at timestamptz,updated_at timestamptz,
  currency text not null,total numeric not null
 );
 create table public.app_settings(user_id uuid primary key,settings jsonb not null);
 create table public.payment_transactions(
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null,
  provider text not null,provider_reference text not null,payment_method text not null,
  status text not null,amount numeric not null,currency text not null,
  idempotency_key text not null,provider_session_id text not null,
  paid_at timestamptz,unique(customer_order_id,idempotency_key)
 );
`);
await db.exec(readFileSync("MIGRACION-V91-73-SUMUP-SINGLE-MERCHANT-LEDGER.sql","utf8"));
await db.query("insert into customer_orders(id,user_id,status,payment_method,payment_status,currency,total,updated_at) values($1,$2,'pending','Online','pending','PLN',123.45,now())",[orderId,merchantId]);
await db.query("insert into app_settings(user_id,settings) values($1,$2)",[merchantId,{onlinePaymentProvider:"disabled"}]);
test.after(()=>db.close());
const reserve=()=>db.query("select public.rc_sumup_reserve_checkout($1,$2,'MCXXXXXX') as a",[orderId,merchantId]);
test("SQL is fail-closed when restaurant has not selected SumUp",async()=>{
 await assert.rejects(reserve(),/SUMUP_RESTAURANT_DISABLED/);
});
test("one exact-cent checkout reserved; replay is not allowed to POST again",async()=>{
 await db.query("update app_settings set settings=$1 where user_id=$2",[{onlinePaymentProvider:"sumup"},merchantId]);
 const first=(await reserve()).rows[0].a;
 assert.equal(first.creationAllowed,true);
 assert.equal(Number(first.amountMinor),12345);
 assert.equal(first.status,"creating");
 const again=(await reserve()).rows[0].a;
 assert.equal(again.creationAllowed,false);
 assert.equal(again.attemptId,first.attemptId);
 const count=await db.query("select count(*)::int as n from rc_sumup_payment_attempts");
 assert.equal(count.rows[0].n,1);
});
test("merchant mismatch and false hosted URL are rejected before marking active",async()=>{
 await assert.rejects(()=>db.query("select public.rc_sumup_reserve_checkout($1,$2,'WRONGMERCH')",[orderId,otherId]),/NOT_ELIGIBLE/);
 const id=(await reserve()).rows[0].a.attemptId;
 await assert.rejects(()=>db.query("select public.rc_sumup_commit_checkout($1,$2,'https://evil.invalid')",[id,checkoutId]),/CHECKOUT_MISMATCH/);
 const ok=await db.query("select public.rc_sumup_commit_checkout($1,$2,$3) as ok",
   [id,checkoutId,"https://checkout.sumup.com/pay/"+checkoutId]);
 assert.equal(ok.rows[0].ok,true);
});
test("pending SumUp checkout blocks a cancelled sale",async()=>{
 await assert.rejects(()=>db.query("update customer_orders set status='cancelled' where id=$1",[orderId]),/SUMUP_RECONCILIATION_REQUIRED/);
});
test("verified PAID is idempotent and creates exactly one recorded payment",async()=>{
 const first=(await db.query("select public.rc_sumup_apply_verified_checkout($1,'PAID') as r",[checkoutId])).rows[0].r;
 assert.equal(first.status,"paid");assert.equal(first.idempotent,false);
 const second=(await db.query("select public.rc_sumup_apply_verified_checkout($1,'PAID') as r",[checkoutId])).rows[0].r;
 assert.equal(second.status,"paid");assert.equal(second.idempotent,true);
 const tx=await db.query("select count(*)::int as n,sum(amount)::numeric as amount from payment_transactions");
 assert.equal(tx.rows[0].n,1);assert.equal(Number(tx.rows[0].amount),123.45);
 const order=await db.query("select payment_status,payment_provider,payment_amount from customer_orders where id=$1",[orderId]);
 assert.equal(order.rows[0].payment_status,"paid");assert.equal(order.rows[0].payment_provider,"sumup");
 assert.equal(Number(order.rows[0].payment_amount),123.45);
});
test("client roles cannot call private reservation RPC directly",async()=>{
 await db.exec("set role anon");
 try {await assert.rejects(reserve(),/permission denied/i);}
 finally {await db.exec("reset role");}
});
