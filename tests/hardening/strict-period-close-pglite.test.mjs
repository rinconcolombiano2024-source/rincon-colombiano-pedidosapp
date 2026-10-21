import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";

const owner=randomUUID(), outsider=randomUUID(), orderId=randomUUID(), clientId=randomUUID();
const db=new PGlite();
await db.exec(`
  create role anon;create role authenticated;
  create table public.restaurant_profiles(
    user_id uuid primary key,timezone text,country_code text,deleted_at timestamptz);
  create table public.orders(
    id uuid primary key,user_id uuid not null,business_date date not null,
    status text,canonical_status text,order_json jsonb,total numeric not null);
  create table public.customer_orders(
    id uuid primary key,user_id uuid not null,restaurant_order_id uuid,
    created_at timestamptz not null,status text,canonical_status text,
    station_status text,payment_status text,payment_method text);
  create table public.order_station_tasks(
    id uuid primary key,customer_order_id uuid,restaurant_user_id uuid,status text);
  create table public.restaurant_period_closures(
    id uuid primary key,restaurant_user_id uuid,period_type text,period_start date,
    period_end date,report_snapshot jsonb,closed_by_user_id uuid,closed_at timestamptz);
  create function public.close_current_restaurant_period(text,date)
    returns void language sql as 'select null::void';
`);
await db.query("insert into restaurant_profiles(user_id,timezone,country_code) values($1,'Europe/Warsaw','PL'),($2,'Europe/Warsaw','PL')",[owner,outsider]);
await db.query("insert into orders(id,user_id,business_date,status,canonical_status,order_json,total) values($1,$2,'2026-10-21','completed','completed',$3,60)",[orderId,owner,{paymentStatus:"paid",paymentMethod:"Efectivo",status:"completed"}]);
await db.query("insert into customer_orders(id,user_id,restaurant_order_id,created_at,status,canonical_status,station_status,payment_status,payment_method) values($1,$2,$3,'2026-10-21T10:00:00Z','delivered','delivered','completed','pending','')",[clientId,owner,orderId]);
await db.exec(readFileSync("MIGRACION-V91-78-STRICT-PAID-AND-COMPLETED-CLOSURE.sql","utf8"));

const snapshot=(overrides={})=>({
  order_count:1,sales_total:60,
  payment_methods:[{payment_method:"Efectivo",orders:1,total:60}],
  ...overrides,
});
const close=async(override={})=>{
  const row={
    id:randomUUID(),restaurant_user_id:owner,period_type:"day",
    period_start:"2026-10-21",period_end:"2026-10-21",
    report_snapshot:snapshot(),closed_by_user_id:owner,...override
  };
  return db.query(`insert into restaurant_period_closures
    (id,restaurant_user_id,period_type,period_start,period_end,report_snapshot,closed_by_user_id)
    values($1,$2,$3,$4,$5,$6,$7)`,
    [row.id,row.restaurant_user_id,row.period_type,row.period_start,row.period_end,row.report_snapshot,row.closed_by_user_id]);
};
test.after(()=>db.close());
test("completed and paid with real cash tender and reconciled report closes",async()=>{
  await assert.doesNotReject(()=>close());
  const n=await db.query("select count(*)::int as n from restaurant_period_closures");
  assert.equal(n.rows[0].n,1);
});
test("new or preparing POS order blocks close and writes no new closure",async()=>{
  for(const status of ["new","received","preparing","ready","on_the_way",""]){
    await db.query("update orders set canonical_status=$1 where id=$2",[status,orderId]);
    await assert.rejects(()=>close(),/RC_ORDERA_CLOSE_ORDERS_UNFINISHED/);
  }
  await db.query("update orders set canonical_status='completed' where id=$1",[orderId]);
});
test("payment pending, processing, failed and unknown all block close",async()=>{
 for(const status of ["pending","processing","failed","unverified",""]){
  await db.query("update orders set order_json=jsonb_set(order_json,'{paymentStatus}',to_jsonb($1::text)) where id=$2",[status,orderId]);
  await assert.rejects(()=>close(),/RC_ORDERA_CLOSE_PAYMENT_NOT_CONFIRMED/);
 }
 await db.query("update orders set order_json=jsonb_set(order_json,'{paymentStatus}','\"paid\"'::jsonb) where id=$1",[orderId]);
});
test("Pago en caja placeholder, unknown, empty method block despite paid flag",async()=>{
 for(const tender of ["Pago en caja","", "unknown","pay at counter"]){
  await db.query("update orders set order_json=jsonb_set(order_json,'{paymentMethod}',to_jsonb($1::text)) where id=$2",[tender,orderId]);
  await assert.rejects(()=>close(),/RC_ORDERA_CLOSE_PAYMENT_METHOD_REQUIRED/);
 }
 await db.query("update orders set order_json=jsonb_set(order_json,'{paymentMethod}','\"Efectivo\"'::jsonb) where id=$1",[orderId]);
});
test("customer new, accepted, preparing, and on_the_way block even if POS completed",async()=>{
 for(const [status,station] of [["created","received"],["accepted","received"],["accepted","preparing"],["on_the_way","dispatched"],["delivered","preparing"]]){
  await db.query("update customer_orders set status=$1,canonical_status=$1,station_status=$2 where id=$3",[status,station,clientId]);
  await assert.rejects(()=>close(),/RC_ORDERA_CLOSE_CLIENT_ORDER_IN_PROGRESS/);
 }
 await db.query("update customer_orders set status='delivered',canonical_status='delivered',station_status='completed' where id=$1",[clientId]);
});
test("physical kitchen preparation blocks even when customer status erroneously completed",async()=>{
 const stationId=randomUUID();
 await db.query("insert into order_station_tasks(id,customer_order_id,restaurant_user_id,status) values($1,$2,$3,'preparing')",[stationId,clientId,owner]);
 await assert.rejects(()=>close(),/RC_ORDERA_CLOSE_STATION_IN_PREPARATION/);
 await db.query("update order_station_tasks set status='ready' where id=$1",[stationId]);
 await assert.doesNotReject(()=>close());
});
test("unlinked customer order with pending payment blocks and local Warsaw date is respected",async()=>{
 const unlinked=randomUUID();
 await db.query("insert into customer_orders(id,user_id,created_at,status,canonical_status,station_status,payment_status,payment_method) values($1,$2,'2026-10-21T10:00:00Z','delivered','delivered','completed','pending','Efectivo')",[unlinked,owner]);
 await assert.rejects(()=>close(),/RC_ORDERA_CLOSE_UNLINKED_CUSTOMER_UNPAID/);
 await db.query("update customer_orders set payment_status='paid' where id=$1",[unlinked]);
 await assert.doesNotReject(()=>close());
 await db.query("delete from customer_orders where id=$1",[unlinked]);
});
test("cancelled ticket and rejected customer do not require collection",async()=>{
 const bad=randomUUID(),discard=randomUUID();
 await db.query("insert into orders(id,user_id,business_date,canonical_status,order_json,total) values($1,$2,'2026-10-21','cancelled',$3,7)",[bad,owner,{}]);
 await db.query("insert into customer_orders(id,user_id,created_at,status,canonical_status,station_status,payment_status,payment_method) values($1,$2,'2026-10-21T10:00:00Z','rejected','rejected','received','pending','')",[discard,owner]);
 await assert.doesNotReject(()=>close());
 await db.query("delete from orders where id=$1",[bad]);
 await db.query("delete from customer_orders where id=$1",[discard]);
});
test("missing totals, ticket mismatch, fraudulent group, or partial allocation blocks",async()=>{
 for(const report of [
  snapshot({payment_methods:[]}),
  snapshot({order_count:2}),
  snapshot({sales_total:61}),
  snapshot({payment_methods:[{payment_method:"Efectivo",orders:1,total:59}]}),
  snapshot({payment_methods:[{payment_method:"Pago en caja",orders:1,total:60}]}),
  snapshot({payment_methods:[{payment_method:"Efectivo",orders:"invalid",total:60}]}),
  snapshot({payment_methods:null}),
 ]){
  await assert.rejects(()=>close({report_snapshot:report}),/RC_ORDERA_CLOSE_REPORT_/);
 }
});
test("another restaurant's unpaid orders and stations do not block this owner",async()=>{
 const strangerOrder=randomUUID(),strangerCustomer=randomUUID();
 await db.query("insert into orders(id,user_id,business_date,canonical_status,order_json,total) values($1,$2,'2026-10-21','preparing',$3,20)",[strangerOrder,outsider,{paymentStatus:"pending",paymentMethod:"Pago en caja"}]);
 await db.query("insert into customer_orders(id,user_id,restaurant_order_id,created_at,status,canonical_status,station_status) values($1,$2,$3,'2026-10-21T10:00:00Z','accepted','accepted','received')",[strangerCustomer,outsider,strangerOrder]);
 await assert.doesNotReject(()=>close());
});
test("blocked UPDATE leaves prior closure snapshot unchanged",async()=>{
 const before=await db.query("select id,report_snapshot from restaurant_period_closures where restaurant_user_id=$1 limit 1",[owner]);
 const id=before.rows[0].id;
 await db.query("update orders set order_json=jsonb_set(order_json,'{paymentStatus}','\"pending\"'::jsonb) where id=$1",[orderId]);
 await assert.rejects(()=>db.query("update restaurant_period_closures set report_snapshot=$1 where id=$2",[snapshot(),id]),/RC_ORDERA_CLOSE_PAYMENT_NOT_CONFIRMED/);
 const after=await db.query("select report_snapshot from restaurant_period_closures where id=$1",[id]);
 assert.deepEqual(after.rows[0].report_snapshot,before.rows[0].report_snapshot);
 await db.query("update orders set order_json=jsonb_set(order_json,'{paymentStatus}','\"paid\"'::jsonb) where id=$1",[orderId]);
});
