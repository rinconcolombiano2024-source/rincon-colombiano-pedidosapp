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
await db.exec(readFileSync("supabase/migrations/20261013055141_sumup_hosted_checkout_url_compat.sql","utf8"));
await db.query("insert into customer_orders(id,user_id,status,payment_method,payment_status,currency,total,updated_at) values($1,$2,'pending','Online','pending','PLN',123.45,now())",[orderId,merchantId]);
await db.query("insert into app_settings(user_id,settings) values($1,$2)",[merchantId,{onlinePaymentProvider:"disabled"}]);
test.after(()=>db.close());
const reserve=()=>db.query("select public.rc_sumup_reserve_checkout($1,$2,'MCXXXXXX') as a",[orderId,merchantId]);
test("SQL is fail-closed when restaurant has not selected SumUp",async()=>{
 await assert.rejects(reserve(),/SUMUP_RESTAURANT_DISABLED/);
});
test("Stripe or another provider reservation always blocks SumUp re-charge",async()=>{
 await db.query("update app_settings set settings=$1 where user_id=$2",[{onlinePaymentProvider:"sumup"},merchantId]);
 await db.query("insert into payment_transactions(customer_order_id,provider,provider_reference,payment_method,status,amount,currency,idempotency_key,provider_session_id) values($1,'stripe','cs_test','online','failed',123.45,'PLN','stripe:uncertain','cs_test')",[orderId]);
 await assert.rejects(reserve(),/SUMUP_OTHER_PROVIDER_RECONCILIATION_REQUIRED/);
 const none=await db.query("select count(*)::int as n from rc_sumup_payment_attempts");
 assert.equal(none.rows[0].n,0);
 await db.query("delete from payment_transactions where customer_order_id=$1",[orderId]);
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
test("official hosted page can have a different UUID than the provider checkout",async()=>{
 const attemptId=(await reserve()).rows[0].a.attemptId;
 await db.exec("begin");
 try {
   const pageId="8f9316a3-cda9-42a9-9771-54d534315676";
   const result=await db.query("select public.rc_sumup_commit_checkout($1,$2,$3) as ok",
     [attemptId,checkoutId,"https://checkout.sumup.com/pay/"+pageId]);
   assert.equal(result.rows[0].ok,true);
 } finally {await db.exec("rollback");}
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
test("provider claim cannot mark paid when another PSP transaction appears asynchronously",async()=>{
 const secondOrder=randomUUID(),secondCheckout=randomUUID();
 await db.query("insert into customer_orders(id,user_id,status,payment_method,payment_status,currency,total,updated_at) values($1,$2,'pending','Online','pending','PLN',11,now())",[secondOrder,merchantId]);
 const reserve2=await db.query("select public.rc_sumup_reserve_checkout($1,$2,'MCXXXXXX') as a",[secondOrder,merchantId]);
 const attemptId=reserve2.rows[0].a.attemptId;
 await db.query("select public.rc_sumup_commit_checkout($1,$2,$3)",[attemptId,secondCheckout,"https://checkout.sumup.com/pay/"+secondCheckout]);
 await db.query("insert into payment_transactions(customer_order_id,provider,provider_reference,payment_method,status,amount,currency,idempotency_key,provider_session_id) values($1,'stripe','cs_uncertain','online','pending',11,'PLN','stripe:earlier','cs_uncertain')",[secondOrder]);
 const response=(await db.query("select public.rc_sumup_apply_verified_checkout($1,'PAID') as r",[secondCheckout])).rows[0].r;
 assert.equal(response.status,"needs_review");
 const [sale,sumupCount]=await Promise.all([
   db.query("select payment_status from customer_orders where id=$1",[secondOrder]),
   db.query("select count(*)::int as n from payment_transactions where customer_order_id=$1 and provider='sumup'",[secondOrder])
 ]);
 assert.equal(sale.rows[0].payment_status,"pending");
 assert.equal(sumupCount.rows[0].n,0);
});
test("all provider paths lock the order before payment attempts",()=>{
 const sql=readFileSync("MIGRACION-V91-73-SUMUP-SINGLE-MERCHANT-LEDGER.sql","utf8");
 for(const name of ["rc_sumup_reserve_checkout","rc_sumup_commit_checkout","rc_sumup_apply_verified_checkout"]){
  const start=sql.indexOf("CREATE OR REPLACE FUNCTION public."+name);
  assert.ok(start>=0);
  const chunk=sql.slice(start,sql.indexOf("END $;",start));
  assert.ok(chunk.indexOf("FROM public.customer_orders")>0);
  assert.ok(chunk.indexOf("FROM public.rc_sumup_payment_attempts")>0);
  const lockedOrder=chunk.indexOf("FROM public.customer_orders",chunk.indexOf("CREATE OR REPLACE FUNCTION"));
  const lockAttempt=chunk.indexOf("FOR UPDATE",lockedOrder)+10;
  assert.match(chunk.slice(lockedOrder,lockAttempt),/FOR UPDATE/);
  assert.match(chunk.slice(lockAttempt),/rc_sumup_payment_attempts[\s\S]*?FOR UPDATE/);
 }
});
test("client roles cannot call private reservation RPC directly",async()=>{
 await db.exec("set role anon");
 try {await assert.rejects(reserve(),/permission denied/i);}
 finally {await db.exec("reset role");}
});

test("new guard blocks reverse PSP reservations and does not discard paid evidence",async()=>{
 await db.exec(readFileSync("supabase/migrations/20261013060200_sumup_cross_provider_reservation_guard.sql","utf8"));
 const id=randomUUID();
 await db.query("insert into customer_orders(id,user_id,status,payment_method,payment_status,currency,total,updated_at) values($1,$2,'pending','Online','pending','PLN',11,now())",[id,merchantId]);
 await db.query("select public.rc_sumup_reserve_checkout($1,$2,'MCXXXXXX')",[id,merchantId]);
 const insert=(status,key)=>db.query("insert into payment_transactions(customer_order_id,provider,provider_reference,payment_method,status,amount,currency,idempotency_key,provider_session_id) values($1,'stripe','cs_test','online',$2,11,'PLN',$3,'cs_test')",[id,status,key]);
 await assert.rejects(()=>insert('pending','stripe:new'),/SUMUP_OTHER_PROVIDER_RECONCILIATION_REQUIRED/);
 await insert('paid','stripe:late-verified-evidence');
 const count=await db.query("select count(*)::int as n from payment_transactions where customer_order_id=$1",[id]);
 assert.equal(count.rows[0].n,1);
});

test("Stripe-only orders are unaffected by the reverse reservation guard",async()=>{
 const id=randomUUID();
 await db.query("insert into customer_orders(id,user_id,status,payment_method,payment_status,currency,total,updated_at) values($1,$2,'pending','Online','pending','PLN',11,now())",[id,merchantId]);
 await db.query("insert into payment_transactions(customer_order_id,provider,provider_reference,payment_method,status,amount,currency,idempotency_key,provider_session_id) values($1,'stripe','cs_normal','online','pending',11,'PLN','stripe:normal','cs_normal')",[id]);
 const count=await db.query("select count(*)::int as n from payment_transactions where customer_order_id=$1",[id]);
 assert.equal(count.rows[0].n,1);
});

test("lost creation response recovers verified PAID without another checkout and remains idempotent",async()=>{
 const id=randomUUID(),pspId=randomUUID();
 await db.query("insert into customer_orders(id,user_id,status,payment_method,payment_status,currency,total,updated_at) values($1,$2,'pending','Online','pending','PLN',11,now())",[id,merchantId]);
 const reserved=(await db.query("select public.rc_sumup_reserve_checkout($1,$2,'MCXXXXXX') as a",[id,merchantId])).rows[0].a;
 const recover=(owner=merchantId,checkout=pspId)=>db.query("select public.rc_sumup_recover_verified_checkout($1,$2,'MCXXXXXX',$3,'PAID',null) as r",[reserved.attemptId,owner,checkout]);
 await assert.rejects(()=>recover(otherId),/IDENTITY_MISMATCH/);
 const result=(await recover()).rows[0].r;assert.equal(result.status,'paid');
 assert.equal((await recover()).rows[0].r.idempotent,true);
 await assert.rejects(()=>recover(merchantId,randomUUID()),/IDENTITY_MISMATCH/);
 const ledger=await db.query("select count(*)::int as n from payment_transactions where customer_order_id=$1",[id]);
 assert.equal(ledger.rows[0].n,1);
});

test("recovery binds evidence but does not pay a changed order; anon cannot recover",async()=>{
 const id=randomUUID(),pspId=randomUUID();
 await db.query("insert into customer_orders(id,user_id,status,payment_method,payment_status,currency,total,updated_at) values($1,$2,'pending','Online','pending','PLN',11,now())",[id,merchantId]);
 const reserved=(await db.query("select public.rc_sumup_reserve_checkout($1,$2,'MCXXXXXX') as a",[id,merchantId])).rows[0].a;
 const recover=()=>db.query("select public.rc_sumup_recover_verified_checkout($1,$2,'MCXXXXXX',$3,'PAID',null) as r",[reserved.attemptId,merchantId,pspId]);
 await db.exec("set role anon");try{await assert.rejects(recover,/permission denied/);}finally{await db.exec("reset role");}
 await db.query("update customer_orders set total=12 where id=$1",[id]);
 assert.equal((await recover()).rows[0].r.status,'needs_review');
 const ledger=await db.query("select count(*)::int as n from payment_transactions where customer_order_id=$1",[id]);
 assert.equal(ledger.rows[0].n,0);
});
