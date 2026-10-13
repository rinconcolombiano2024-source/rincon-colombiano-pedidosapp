import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {bootstrap,setupOrders,R} from '../support/v5-fixtures.mjs';
const db=new PGlite({extensions:{pgcrypto}});
await bootstrap(db);await setupOrders(db);
await db.exec(`create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
alter table customer_orders add column station_status text;
create table restaurant_staff_memberships(restaurant_user_id uuid,member_user_id uuid,station text,active boolean);
create table order_station_tasks(customer_order_id uuid,restaurant_user_id uuid,station text,status text,started_at timestamptz,completed_at timestamptz,updated_at timestamptz);`);
for(const name of ['customer-edge','customer-core','station'])await db.exec(readFileSync(`tests/fixtures/deployed-20261011/${name}.sql`,'utf8'));
await db.exec('revoke all on function rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric) from public,anon,authenticated;');
await db.exec(readFileSync('MIGRACION-V6-20261011-01-DEPLOYED-RPC-COMPAT.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20261013055623_sumup_order_provider_compat.sql','utf8'));
test.after(()=>db.close());
const params=id=>[id,R,'a-private-token-with-32-characters','table','Test customer','Recoger en el punto',JSON.stringify({paymentMethod:'Pago al recoger',items:[{product_id:'dish',quantity:2}]}),null,0];
const edge=id=>db.query('select * from rc_ordera_create_customer_order_edge($1,$2,$3,$4,$5,$6,$7,$8,$9)',params(id));
test('both entry points retain one order and paid amount after retry',async()=>{
 const id=randomUUID();await edge(id);await db.query("update customer_orders set payment_status='paid' where id=$1",[id]);
 const p=params(id);p.splice(7,1);
 await db.query('select * from create_customer_order_v91_22_core($1,$2,$3,$4,$5,$6,$7,$8)',p);
 const {rows}=await db.query('select total,payment_status from customer_orders where id=$1',[id]);assert.equal(rows.length,1);assert.equal(Number(rows[0].total),31);assert.equal(rows[0].payment_status,'paid');
});
test('SumUp online order works through both existing entry points at server prices',async()=>{
 await db.query("update app_settings set settings=settings || '{\"onlinePaymentProvider\":\"sumup\"}'::jsonb where user_id=$1",[R]);
 for (const useCore of [false,true]) {
   const id=randomUUID(),p=params(id);
   p[6]=JSON.stringify({paymentMethod:'Online',items:[{product_id:'dish',quantity:2,price:0.01}]});
   if(useCore){p.splice(7,1);await db.query('select * from create_customer_order_v91_22_core($1,$2,$3,$4,$5,$6,$7,$8)',p);}
   else await db.query('select * from rc_ordera_create_customer_order_edge($1,$2,$3,$4,$5,$6,$7,$8,$9)',p);
   const {rows}=await db.query('select total,payment_status from customer_orders where id=$1',[id]);
   assert.equal(Number(rows[0].total),31);assert.equal(rows[0].payment_status,'pending');
 }
 await db.query("update app_settings set settings=settings-'onlinePaymentProvider' where user_id=$1",[R]);
});

test('migration retains private RPC execution permissions',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>edge(randomUUID()),/permission denied/);await db.exec('reset role');}
});
test('packing cannot bypass unfinished kitchen and inactive restaurant is rejected',async()=>{
 const member=randomUUID(),id=randomUUID();await edge(id);
 await db.exec(`set test.uid='${member}'`);
 await db.query("insert into restaurant_staff_memberships values($1,$2,'packing',true)",[R,member]);
 await db.query("update customer_orders set status='accepted',station_status='ready' where id=$1",[id]);
 await db.query("insert into order_station_tasks(customer_order_id,restaurant_user_id,station,status) values($1,$2,'packing','received'),($1,$2,'kitchen','preparing')",[id,R]);
 const pack=()=>db.query("select * from update_my_station_order($1,$2,'packed','packing')",[R,id]);
 await assert.rejects(pack,/Station transition is not allowed/);
 await db.query("update order_station_tasks set status='ready' where customer_order_id=$1 and station='kitchen'",[id]);await pack();
 await db.query('update restaurant_profiles set active=false where user_id=$1',[R]);await assert.rejects(pack,/Station is not authorized/);
});
test('second application rejects unexpected base instead of overwriting',async()=>{
 await assert.rejects(()=>db.exec(readFileSync('MIGRACION-V6-20261011-01-DEPLOYED-RPC-COMPAT.sql','utf8')),/DEPLOYED_RPC_MISMATCH/);await db.exec('rollback');
});
