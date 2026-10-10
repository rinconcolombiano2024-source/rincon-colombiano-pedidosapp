import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {PostgresOutboxStore} from '../../delivery-bridge/src/postgres-outbox-store.mjs';
import {DeliveryOutbox} from '../../delivery-bridge/src/outbox.mjs';
import {sql,R,B,O,D,token,bootstrap,setupOrders} from '../support/v5-fixtures.mjs';
test('B/E: real outbox SQL, two logical workers, durable restart, tenant isolation, RLS and recovery',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});try{
  await bootstrap(db);await db.exec(sql('MIGRACION-V5-20261010-03-DELIVERY-OUTBOX.sql'));
  const query=db.query.bind(db),s1=new PostgresOutboxStore({query,restaurantId:R}),s2=new PostgresOutboxStore({query,restaurantId:R});
  let n=0;const fetchImpl=async()=>{n++;return {ok:true};};
  const registry={create:()=>({meta:{provisional:false},buildOutbound:()=>({url:'https://fixture.invalid',method:'POST',headers:{}})})};
  const one=new DeliveryOutbox({store:s1,restaurantId:R,registry,fetchImpl}),two=new DeliveryOutbox({store:s2,restaurantId:R,registry,fetchImpl});
  const entries=await Promise.all([one.enqueue({provider:'wolt',orderId:'x',action:'accept'}),two.enqueue({provider:'wolt',orderId:'x',action:'accept'})]);
  assert.equal(entries.filter(x=>!x.duplicate).length,1);await Promise.all([one.tick(),two.tick()]);assert.equal(n,1);
  assert.equal((await new PostgresOutboxStore({query,restaurantId:R}).list())[0].state,'sent');
  const other=new PostgresOutboxStore({query,restaurantId:B});assert.deepEqual(await other.list(),[]);assert.equal(await other.get(entries[0].id),null);
  await assert.rejects(()=>other.resolve(entries[0].id,'sent','evidence'),/NOT_UNKNOWN/);
  const next=await one.enqueue({provider:'wolt',orderId:'crash',action:'accept'}),now=Date.now();const claimed=await s1.claim(next.id,'owner',now,100);
  await s2.recover(now+101);assert.equal((await s1.get(next.id)).state,'unknown');await assert.rejects(()=>s1.finish({...claimed,state:'sent'},'owner'),/CLAIM_LOST/);
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);
   await assert.rejects(()=>db.query('select * from public.rc_delivery_outbox_v5'),/permission denied/);
   await assert.rejects(()=>db.query("update public.rc_delivery_outbox_v5 set entry='{}'"),/permission denied/);
   await db.exec('reset role');
  }
  assert.ok((await db.query('select count(*)::int as n from rc_delivery_outbox_events_v5')).rows[0].n>=5);
 }finally{await db.close();}
});
test('C/H: fiscal migrations execute; UNKNOWN blocks claims; result retry is idempotent',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});try{
  await bootstrap(db);
  for(const file of ['MIGRACION-V91-34-FISCAL-BASE.sql','MIGRACION-V91-35-FISCAL-CLAIM.sql','MIGRACION-V5-20261010-01-FISCAL-AGENT-RESULT.sql'])await db.exec(sql(file));
  await db.query("insert into fiscal_devices(id,restaurant_user_id,device_name,enabled) values($1,$2,'fixture',true)",[D,R]);
  await db.query("insert into fiscal_operations(id,restaurant_user_id,order_id,payload) values($1,$2,$3,'{}')",[O,R,randomUUID()]);
  assert.equal((await db.query('select * from rc_fiscal_claim_next($1,$2,$3)',[R,D,token])).rows.length,1);
  await db.query('select rc_fiscal_mark_sending($1,$2,$3)',[O,D,token]);
  const result={reason:'response_lost'};
  for(let i=0;i<2;i++)await db.query('select rc_fiscal_record_result($1,$2,$3,$4,$5)',[O,D,token,'unknown',JSON.stringify(result)]);
  assert.equal((await db.query('select * from rc_fiscal_claim_next($1,$2,$3)',[R,D,token])).rows.length,0);
  assert.equal((await db.query("select count(*)::int as n from fiscal_events where event_type='result_recorded'")).rows[0].n,1);
  await assert.rejects(()=>db.query('select rc_fiscal_record_result($1,$2,$3,$4,$5)',[O,D,token,'confirmed',JSON.stringify({fiscal:true})]),/MOCK_CANNOT/);
  const confirmed=JSON.stringify({simulated:true,fiscal:false});
  for(let i=0;i<2;i++)await db.query('select rc_fiscal_record_result($1,$2,$3,$4,$5)',[O,D,token,'confirmed',confirmed]);
  assert.equal((await db.query('select state from fiscal_operations where id=$1',[O])).rows[0].state,'confirmed');
  await assert.rejects(()=>db.query('select rc_fiscal_record_result($1,$2,$3,$4,$5)',[O,D,'b'.repeat(64),'failed','{}']),/CLAIM_TOKEN/);
 }finally{await db.close();}
});

test('A/H: actual customer-order RPC preserves one order, token ownership and VAT snapshot',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});try{
  await bootstrap(db);await setupOrders(db);
  const id=randomUUID(),publicToken='fixture-secret-token-32-characters';
  const call=(restaurant=R,secret=publicToken)=>db.query('select * from rc_ordera_create_customer_order_edge($1,$2,$3,$4,$5,$6,$7,$8,$9)',
   [id,restaurant,secret,'fixture','Test customer','Recoger en el punto',JSON.stringify({paymentMethod:'Pago al recoger',items:[{product_id:'dish',quantity:2}]}),null,0]);
  const result=await Promise.all(Array.from({length:20},()=>call()));
  assert.equal(new Set(result.map(r=>r.rows[0].id)).size,1);
  assert.equal((await db.query('select count(*)::int as n from customer_orders')).rows[0].n,1);
  const row=(await db.query('select * from customer_orders')).rows[0];assert.equal(Number(row.total),31);
  assert.equal(row.order_json.items[0].vat_rate_snapshot,'8');assert.equal(row.order_json.items[0].quantity,2);
  await assert.rejects(()=>call(B),/Idempotency conflict/);await assert.rejects(()=>call(R,'wrong-token-32-characters'),/Idempotency conflict/);
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);await assert.rejects(()=>call(),/permission denied/);await db.exec('reset role');
  }
 }finally{await db.close();}
});
