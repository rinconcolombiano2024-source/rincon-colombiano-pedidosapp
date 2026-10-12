import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {randomUUID} from 'node:crypto';
import {PostgresOutboxStore} from '../../delivery-bridge/src/postgres-outbox-store.mjs';
import {DeliveryOutbox,MemoryOutboxStore} from '../../delivery-bridge/src/outbox.mjs';
import {bootstrap,sql,R,B} from '../support/v5-fixtures.mjs';
const registry={create:()=>({meta:{provisional:false},buildOutbound:()=>({url:'https://fixture.invalid',method:'POST',headers:{}})})};
const db=new PGlite({extensions:{pgcrypto}});await bootstrap(db);
await db.exec(sql('MIGRACION-V5-20261010-03-DELIVERY-OUTBOX.sql'));await db.exec(sql('MIGRACION-V5-20261010-06-OUTBOX-BOUNDS.sql'));
test.after(()=>db.close());
const store=()=>new PostgresOutboxStore({restaurantId:R,query:db.query.bind(db)});
const box=(s,more={})=>new DeliveryOutbox({store:s,restaurantId:R,registry,fetchImpl:async()=>({ok:true}),...more});
test('batch bounds, keyset diagnostic pages and SQL atomic claims conserve all commands',async()=>{
 let sends=0;const one=box(store(),{batchSize:7,fetchImpl:async()=>{sends++;return {ok:true};}});
 for(let i=0;i<20;i++)await one.enqueue({provider:'wolt',orderId:'batch-'+i,action:'accept'});
 for(const expected of [7,7,6])assert.equal((await one.tick()).sent,expected);
 assert.equal(sends,20);assert.equal((await one.tick()).sent,0);
 let ids=[];let afterId=null;for(;;){const page=await store().list({limit:6,afterId});if(!page.length)break;ids.push(...page.map(e=>e.id));afterId=page.at(-1).id;}
 assert.equal(new Set(ids).size,20);assert.equal(ids.length,20);
 await assert.rejects(()=>store().list({limit:0}),/INVALID_PAGE/);await assert.rejects(()=>store().due(Date.now(),501),/INVALID_PAGE/);
});
test('SQL ready claim requires confirmed accept; cross-tenant commands are excluded',async()=>{
 const a=box(store()),o='order-'+randomUUID();const ready=await a.enqueue({provider:'wolt',orderId:o,action:'ready'});
 assert.equal(await store().claim(ready.id,'token',Date.now(),30000),null);
 const accept=await a.enqueue({provider:'wolt',orderId:o,action:'accept'});const owned=await store().claim(accept.id,'owner',Date.now(),30000);
 assert.equal(await store().claim(ready.id,'token',Date.now(),30000),null);await store().finish({...owned,state:'sent'},'owner');
 assert.ok(await store().claim(ready.id,'token',Date.now(),30000));
 const other=new PostgresOutboxStore({restaurantId:B,query:db.query.bind(db)});assert.deepEqual(await other.due(Date.now()),[]);assert.equal(await other.get(ready.id),null);
});
test('required JSON null/missing fields cannot exploit PostgreSQL NULL CHECK semantics',async()=>{
 for(const entry of [{}, {id:'e'.repeat(32),restaurantId:R,state:null,provider:null,orderId:'x',action:'accept',createdAt:1,nextAttemptAt:1,deadlineAt:2,attempts:0,payload:{}}]){
  await assert.rejects(()=>db.query('insert into rc_delivery_outbox_v5(id,restaurant_user_id,entry) values($1,$2,$3)', ['e'.repeat(32),R,JSON.stringify(entry)]),/check constraint/);
 }
});
test('bounded recovery preserves UNKNOWN and rejects stale owner completion',async()=>{
 const s=store(),b=box(s);let rows=[];
 for(let i=0;i<5;i++){const e=await b.enqueue({provider:'glovo',orderId:'crash-'+i,action:'cancel'});rows.push(await s.claim(e.id,'owner',1_000_000_000_0000,1));}
 // Future now is deterministic; no network calls are made.
 await s.recover(1_000_000_000_0002,2);
 const recovered=await s.list({states:['unknown'],limit:100});assert.equal(recovered.length,2);
 await s.recover(1_000_000_000_0002,2);await s.recover(1_000_000_000_0002,2);
 for(const e of rows)await assert.rejects(()=>s.finish({...e,state:'sent'},'owner'),/CLAIM_LOST/);
});
test('100 ticks on one instance coalesce; fresh lease timestamp for each sequential command',async()=>{
 let now=1000,n=0;const s=new MemoryOutboxStore(),leases=[];const original=s.claim.bind(s);
 s.claim=async(...args)=>{leases.push(args[2]);return original(...args);};
 const b=new DeliveryOutbox({store:s,registry,simulationOnly:true,now:()=>now,fetchImpl:async()=>{n++;now+=2000;await new Promise(r=>setImmediate(r));return {ok:true};}});
 for(let i=0;i<3;i++)await b.enqueue({provider:'wolt',orderId:'fresh-'+i,action:'accept'});
 const results=await Promise.all(Array.from({length:100},()=>b.tick()));assert.equal(n,3);assert.ok(results.every(r=>r.sent===3));assert.deepEqual(leases,[1000,3000,5000]);
});

test('deferred accept cannot starve executable cancel in a one-row SQL batch',async()=>{
 const s=store(),b=box(s),now=Date.now(),id=randomUUID();
 const ready=await b.enqueue({provider:'wolt',orderId:id,action:'ready'});
 const accept=await b.enqueue({provider:'wolt',orderId:id,action:'accept'});
 const owned=await s.claim(accept.id,'owner',now+100,30000);
 await s.finish({...owned,state:'pending',nextAttemptAt:now+60000},'owner');
 const cancel=await b.enqueue({provider:'wolt',orderId:'cancel-'+id,action:'cancel'});
 const page=await s.due(now+1000,1);
 assert.equal(page[0].id,cancel.id);assert.equal(await s.claim(ready.id,'blocked',now+1000,30000),null);
});
test('processing accept cannot consume ready slot; ready appears once accept confirmed',async()=>{
 const s=store(),b=box(s),now=Date.now(),id=randomUUID();
 const ready=await b.enqueue({provider:'glovo',orderId:id,action:'ready'});
 const accept=await b.enqueue({provider:'glovo',orderId:id,action:'accept'});
 const owned=await s.claim(accept.id,'owner',now+100,30000);
 assert.ok(!(await s.due(now+1000,500)).some(e=>e.id===ready.id));
 await s.finish({...owned,state:'sent'},'owner');
 assert.ok((await s.due(now+1000,500)).some(e=>e.id===ready.id));
});
test('memory queue matches dependency filtering and preserves executable commands',async()=>{
 const s=new MemoryOutboxStore(),b=new DeliveryOutbox({store:s,registry,simulationOnly:true,now:()=>1000,fetchImpl:async()=>({ok:true})});
 const ready=await b.enqueue({provider:'wolt',orderId:'delayed',action:'ready'});
 const accept=await b.enqueue({provider:'wolt',orderId:'delayed',action:'accept'});
 const owned=await s.claim(accept.id,'owner',1000,30000);
 assert.ok(!(await s.due(1000,500)).some(e=>e.id===ready.id));
 await s.finish({...owned,state:'pending',nextAttemptAt:2000},'owner');
 const cancel=await b.enqueue({provider:'wolt',orderId:'other',action:'cancel'});
 assert.equal((await s.due(1000,1))[0].id,cancel.id);
 assert.equal(await s.claim(ready.id,'blocked',1000,30000),null);
 assert.ok((await s.due(2000,500)).some(e=>e.id===ready.id));
});
