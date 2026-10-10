import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fromCustomerOrderRow} from '../../accounting/src/adapters.mjs';
import {buildDailyClose} from '../../accounting/src/daily-close.mjs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {bootstrap,setupOrders,sql,R,B} from '../support/v5-fixtures.mjs';
const db=new PGlite({extensions:{pgcrypto}});
await bootstrap(db);await setupOrders(db);
await db.exec(sql('MIGRACION-V5-20261010-04-VAT-CATEGORIES.sql'));
await db.exec(sql('MIGRACION-V5-20261010-05-ORDER-MENU-INTEGRITY.sql'));
await db.exec(sql('MIGRACION-V5-20261010-10-EXPLICIT-VAT-UNKNOWN.sql'));
test.after(()=>db.close());
async function menu(items,settings={}){await db.query('update app_settings set menu=$1,settings=$2 where user_id=$3',[JSON.stringify({Main:items}),JSON.stringify(settings),R]);}
const dish=(over={})=>({id:'dish',name:'Arepa',price:15.50,available:true,vatRate:'8',...over});
const call=(over={})=>db.query('select * from rc_ordera_create_customer_order_edge($1,$2,$3,$4,$5,$6,$7,$8,$9)',[over.id??randomUUID(),over.restaurant??R,over.token??'a-private-token-with-32-characters','table','Test customer','Recoger en el punto',JSON.stringify({paymentMethod:'Pago al recoger',items:over.items??[{product_id:'dish',quantity:2}]}),over.customer??null,0]);
test('corrected RPC keeps separate tax snapshots, even with a conflicting default',async()=>{
 for(const rate of ['NP','NP I','NP II','ZW','0']){
  await menu([dish({vatRate:rate})],{defaultVatRate:'23'});const r=await call();
  const row=(await db.query('select order_json from customer_orders where id=$1',[r.rows[0].id])).rows[0];assert.equal(row.order_json.items[0].vat_rate_snapshot,rate);
 }
 await menu([dish({vatRate:'unsupported'})],{defaultVatRate:'23'});const r=await call();
 assert.equal((await db.query('select order_json from customer_orders where id=$1',[r.rows[0].id])).rows[0].order_json.items[0].vat_rate_snapshot,null);
});
test('duplicate configured product identity is rejected rather than arbitrary first match',async()=>{
 await menu([dish(),dish({price:1})]);await assert.rejects(()=>call(),/Ambiguous product identity/);
});
test('closed restaurant, removed or unavailable product and hostile quantities fail',async()=>{
 await menu([dish()]);await db.query('update restaurant_profiles set operational_open=false where user_id=$1',[R]);
 await assert.rejects(()=>call(),/Restaurant is closed/);await db.query('update restaurant_profiles set operational_open=true where user_id=$1',[R]);
 await menu([]);await assert.rejects(()=>call(),/Product not found/);
 await menu([dish({available:false})]);await assert.rejects(()=>call(),/Product unavailable/);
 await menu([dish()]);for(const quantity of [0,-1,1.5,51,'2',null])await assert.rejects(()=>call({items:[{product_id:'dish',quantity}]}),/quantity/);
});
test('idempotent retries after confirmed payment retain identity and original price',async()=>{
 await menu([dish()]);const id=randomUUID();await Promise.all(Array.from({length:20},()=>call({id})));
 await db.query("update customer_orders set payment_status='paid',status='accepted' where id=$1",[id]);
 await menu([dish({price:20})]);await call({id});
 const r=(await db.query('select * from customer_orders where id=$1',[id])).rows[0];assert.equal(Number(r.total),31);assert.equal(r.payment_status,'paid');assert.equal(r.status,'accepted');
 assert.equal((await db.query('select count(*)::int as n from customer_orders where id=$1',[id])).rows[0].n,1);
 await assert.rejects(()=>call({id,restaurant:B}),/Idempotency conflict/);await assert.rejects(()=>call({id,token:'different-private-token'}),/Idempotency conflict/);
});
test('new orders use current server price; negative/missing configured price cannot become zero silently',async()=>{
 await menu([dish({price:20})]);const r=await call();assert.equal(Number((await db.query('select total from customer_orders where id=$1',[r.rows[0].id])).rows[0].total),40);
 for(const price of [-1,null,'20']){await menu([dish({price})]);await assert.rejects(()=>call(),/Invalid configured product price/);}
});
test('anon and authenticated cannot call corrected internal order RPC or tax helper',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);await assert.rejects(()=>call(),/permission denied/);
  await assert.rejects(()=>db.query("select rc_ordera_normalize_vat_rate('\"NP\"')"),/permission denied/);await db.exec('reset role');
 }
});

test('price changed after the customer saw the menu rejects the new sale before charge',async()=>{
 await menu([dish({price:20})]);
 await assert.rejects(()=>call({items:[{product_id:'dish',quantity:2,unit_price_snapshot:15.50}]}),/Menu changed before order/);
 const r=await call({items:[{product_id:'dish',quantity:2,unit_price_snapshot:20}]});
 assert.equal(Number((await db.query('select total from customer_orders where id=$1',[r.rows[0].id])).rows[0].total),40);
});

test('explicit null VAT stays unknown; only absent VAT inherits restaurant default',async()=>{
 await menu([dish({vatRate:null})],{defaultVatRate:'23'});let r=await call();
 assert.equal((await db.query('select order_json from customer_orders where id=$1',[r.rows[0].id])).rows[0].order_json.items[0].vat_rate_snapshot,null);
 const stored=(await db.query('select * from customer_orders where id=$1',[r.rows[0].id])).rows[0];
 const report=buildDailyClose({orders:[fromCustomerOrderRow({...stored,status:'delivered',currency:'PLN',payment_method:'cash'})]},{date:stored.created_at.toISOString().slice(0,10),timeZone:'UTC',defaultVatRate:'23'});
 assert.equal(report.valid,false);assert.ok(report.issues.some(i=>i.code==='VAT_SNAPSHOT_UNKNOWN'));assert.equal(report.vatAssumedLines,0);
 const d=dish();delete d.vatRate;await menu([d],{defaultVatRate:'23'});r=await call();
 assert.equal((await db.query('select order_json from customer_orders where id=$1',[r.rows[0].id])).rows[0].order_json.items[0].vat_rate_snapshot,'23');
 await db.exec(sql('MIGRACION-V5-20261010-10-EXPLICIT-VAT-UNKNOWN.sql')); // idempotent application
});
