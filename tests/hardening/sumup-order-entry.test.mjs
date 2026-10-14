import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {bootstrap,setupOrders,R} from '../support/v5-fixtures.mjs';
const db=new PGlite({extensions:{pgcrypto}});
await bootstrap(db);await setupOrders(db);
await db.exec(readFileSync('tests/fixtures/deployed-20261011/customer-edge.sql','utf8'));
await db.exec('revoke all on function rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric) from public,anon,authenticated;');
const migration=readFileSync('MIGRACION-V91-74-SUMUP-ORDER-ENTRY.sql','utf8');
const definition=async()=>(await db.query("select pg_get_functiondef('public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric)'::regprocedure) as source")).rows[0].source;
const before=await definition();
await assert.rejects(()=>db.exec(migration),/PREREQUISITES_MISSING/);await db.exec('rollback');
// This test exercises order entry, not provider reservation (covered in ledger tests).
await db.exec('create function rc_sumup_reserve_checkout(uuid,uuid,text) returns jsonb language sql as $$select null::jsonb$$;');
await db.exec(migration);
test.after(()=>db.close());
const call=(mode='Recoger en el punto',extra={})=>db.query('select * from rc_ordera_create_customer_order_edge($1,$2,$3,$4,$5,$6,$7,$8,$9)',[randomUUID(),R,'a-private-token-with-32-characters','table','Test customer',mode,{paymentMethod:'Online',items:[{product_id:'dish',quantity:2}],...extra},null,0]);
const provider=p=>db.query("update app_settings set settings=jsonb_build_object('onlinePaymentProvider',$1::text) where user_id=$2",[p,R]);
test('migration changes only the payment gate and can be repeated',async()=>{
 const old=migration.split('$old$')[1],next=migration.split('$new$')[1];
 assert.equal(await definition(),before.replace(old,next));
 await db.exec(migration);assert.equal(await definition(),before.replace(old,next));
});
test('SumUp pickup/local retains authoritative menu price and pending payment',async()=>{
 await provider('sumup');
 for(const mode of ['Recoger en el punto','Comer en el punto']){
  const result=await call(mode);
  const row=(await db.query('select total,payment_status from customer_orders where id=$1',[result.rows[0].id])).rows[0];
  assert.equal(Number(row.total),31);assert.equal(row.payment_status,'pending');
 }
});
test('SumUp rejects delivery, tips and non-Polish restaurants; Stripe and cash remain usable',async()=>{
 await provider('sumup');await assert.rejects(()=>call('Domicilio'),/Online payment is unavailable/);
 await assert.rejects(()=>call('Recoger en el punto',{tipAmount:1}),/Online payment is unavailable/);
 await db.query("update restaurant_profiles set country_code='CO' where user_id=$1",[R]);
 await assert.rejects(()=>call(),/Online payment is unavailable/);
 await db.query("update restaurant_profiles set country_code='PL' where user_id=$1",[R]);
 await provider('stripe');await call();
 await provider('disabled');await assert.rejects(()=>call(),/Online payment is unavailable/);
 await call('Recoger en el punto',{paymentMethod:'Efectivo'});
});
test('migration does not open service-role RPC to customers',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>call(),/permission denied/);await db.exec('reset role');}
});
