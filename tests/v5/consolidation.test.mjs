import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DeliveryOutbox,MemoryOutboxStore} from '../../delivery-bridge/src/outbox.mjs';
import {reconcileProvider} from '../../accounting/src/reconcile.mjs';
import {FileJournal} from '../../fiscal-agent/src/file-journal.mjs';
import {NovitusNoviApiDriver} from '../../fiscal-agent/src/drivers/novitus-noviapi.mjs';
import {createPreparedDeliveryRegistry} from '../../delivery-bridge/src/adapter-registry.mjs';
const registry={create:()=>({buildOutbound:()=>({url:'https://fixture.invalid',method:'POST',headers:{}})})};
const options=(store,fetchImpl,extra={})=>({store,registry,fetchImpl,simulationOnly:true,...extra});

test('B: two workers and concurrent enqueues send exactly one command',async()=>{
 const store=new MemoryOutboxStore();let sends=0;let unblock;const blocked=new Promise(r=>unblock=r);
 const fetchImpl=async()=>{sends++;await blocked;return {ok:true};};
 const a=new DeliveryOutbox(options(store,fetchImpl)),b=new DeliveryOutbox(options(store,fetchImpl));
 const results=await Promise.all(Array.from({length:100},(_,i)=>(i%2?a:b).enqueue({provider:'wolt',orderId:'same',action:'accept'})));
 assert.equal(results.filter(r=>!r.duplicate).length,1);
 const first=a.tick();await new Promise(r=>setImmediate(r));const second=await b.tick();assert.equal(sends,1);assert.equal(second.sent,0);unblock();await first;
 assert.equal((await store.list())[0].state,'sent');assert.equal(store.events.filter(e=>e.type==='claimed').length,1);
});
test('lost network response and HTTP 409 are UNKNOWN without retry',async()=>{
 for(const status of [null,409]){
  const store=new MemoryOutboxStore();let n=0;
  const box=new DeliveryOutbox(options(store,async()=>{n++;if(status===null)throw new Error('lost');return {ok:false,status};}));
  await box.enqueue({provider:'wolt',orderId:'same',action:'accept'});
  assert.equal((await box.tick()).unknown,1);await box.tick();assert.equal(n,1);
  await assert.rejects(()=>box.reconcile((store.events[0]).id,'sent',''),/EVIDENCE/);
  await box.reconcile(store.events[0].id,'sent','provider sandbox confirmed command');
  assert.equal((await store.list())[0].state,'sent');
 }
});
test('crashed delivery worker expires to unknown and stale owner cannot overwrite',async()=>{
 const store=new MemoryOutboxStore();const box=new DeliveryOutbox(options(store,async()=>({ok:true})));
 const {id}=await box.enqueue({provider:'wolt',orderId:'x',action:'accept'});
 const e=await store.claim(id,'owner',Date.now(),1);await store.recover(Date.now()+100);
 assert.equal((await store.get(id)).state,'unknown');await assert.rejects(()=>store.finish({...e,state:'sent'},'owner'),/CLAIM_LOST/);
});
test('tenant identity contributes to keys and aliases normalize consistently',()=>{
 assert.notEqual(DeliveryOutbox.idFor('wolt','x','accept','A'),DeliveryOutbox.idFor('wolt','x','accept','B'));
 assert.equal(DeliveryOutbox.idFor('ubereats','x','accept'),DeliveryOutbox.idFor('uber_eats','x','accept'));
 assert.equal(DeliveryOutbox.idFor('boltfood','x','accept'),DeliveryOutbox.idFor('bolt_food','x','accept'));
 assert.throws(()=>new DeliveryOutbox({registry}),/DURABLE_TENANT/);
 assert.throws(()=>new DeliveryOutbox({registry,simulationOnly:true}),/SIMULATION_FETCH/);
});
test('provisional providers never transmit in production',async()=>{
 const store=new MemoryOutboxStore();store.durable=true;let n=0;
 const box=new DeliveryOutbox({store,restaurantId:'test-restaurant',registry:createPreparedDeliveryRegistry(),providerOptions:{wolt:{apiKey:'fixture'}},fetchImpl:async()=>{n++;return {ok:true};}});
 await box.enqueue({provider:'wolt',orderId:'x',action:'accept'});assert.equal((await box.tick()).dead,1);assert.equal(n,0);
});
test('D: duplicate payment references in either source cannot match silently',()=>{
 const p={provider_reference:'pi_test',amount:'10.00',currency:'PLN',status:'paid'};
 const r={reference:'pi_test',amount:'10.00',currency:'PLN'};
 for(const [local,remote] of [[[p,p],[r]],[[p],[r,r]],[[p,{...p,amount:'9.00'}],[r]]]){
  const report=reconcileProvider(local,remote);assert.equal(report.ok,false);assert.deepEqual(report.matched,[]);
  assert.ok(report.duplicateLocal.length||report.duplicateProvider.length);
 }
 assert.equal(reconcileProvider([{...p,provider_reference:' pi_test'}],[r]).ok,false);
});
test('fiscal journal persists before restart and excludes a second local process',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'rc-journal-'));try{
  const file=join(dir,'journal.json');const first=new FileJournal(file);await first.put({operationId:'op',phase:'unknown'});
  assert.throws(()=>new FileJournal(file),/JOURNAL_LOCKED/);first.close();
  const restarted=new FileJournal(file);assert.equal((await restarted.list())[0].phase,'unknown');restarted.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Novitus assumed protocol cannot open physical or network connection',()=>{
 assert.throws(()=>new NovitusNoviApiDriver({baseUrl:'https://device',username:'u',password:'p'}),{code:'PROTOCOL_UNVERIFIED'});
});
test('G: every distributed www source matches root, including integration centre',()=>{
 for(const file of readdirSync('www')){
  if(file==='BUILD-METADATA.json')continue;
  if(existsSync(file)&&!file.includes('.'))continue;
  if(existsSync(file))assert.deepEqual(readFileSync(join('www',file)),readFileSync(file),file);
 }
 for(const file of ['vendor/SUPABASE-LICENSE.txt','app.js','cliente.js','mesero.js','colaborador.js','admin.js','centro-integraciones.html','centro-integraciones-status.js'])assert.deepEqual(readFileSync(join('www',file)),readFileSync(file));
});
test('H: V5 migration IDs unique; GitHub review migrations remain present',()=>{
 const files=readdirSync('.').filter(f=>f.startsWith('MIGRACION-V5-'));
 const ids=files.map(f=>f.match(/^MIGRACION-(V5-\d{8}-\d{2})-/)[1]);assert.equal(new Set(ids).size,ids.length);
 assert.ok(existsSync('MIGRACION-V91-69-EXTERNAL-REVIEW-GATE.sql'));assert.ok(existsSync('MIGRACION-V91-70-EXTERNAL-BATCH-REVIEW-COMPAT.sql'));
 assert.equal(existsSync('MIGRACION-V91-69-FISCAL-AGENT-RESULT.sql'),false);
 assert.equal(existsSync('MIGRACION-V91-70-ORDEN-IDEMPOTENTE-IVA.sql'),false);
});

import {buildDailyClose} from '../../accounting/src/daily-close.mjs';
import {fromCustomerOrderRow} from '../../accounting/src/adapters.mjs';
import {toGrosz} from '../../accounting/src/money.mjs';
test('accounting rounds per document, flags unsupported refunds, and never double counts duplicated orders',()=>{
 const order=id=>({id,status:'delivered',total:'0.04',currency:'PLN',payment_method:'cash',payment_status:'pending',created_at:'2026-10-10T12:00:00Z',items:[{lineTotal:'0.04',vatRate:23,productId:'dish',quantity:1}]});
 const c=buildDailyClose({orders:[order('A'),order('B')]},{date:'2026-10-10'});
 assert.equal(c.vat.vat,2);assert.equal(c.vat.net,6);assert.equal(c.quantitiesByProduct.dish,2);
 const dup=buildDailyClose({orders:[order('A'),order('A')]},{date:'2026-10-10'});assert.equal(dup.valid,false);assert.equal(dup.grossGrosz,0);
 const ref=buildDailyClose({refunds:[{id:'r',payment_transaction_id:'p',status:'succeeded',amount:'1.00',processed_at:'2026-10-10T12:00:00Z'}]},{date:'2026-10-10'});
 assert.equal(ref.valid,false);assert.ok(ref.issues.some(i=>i.code==='REFUND_VAT_ALLOCATION_REQUIRED'));
 assert.throws(()=>toGrosz('1.005'));assert.throws(()=>toGrosz(1.005));
 const row=fromCustomerOrderRow({order_json:{items:[{product_id:'dish',unit_price_snapshot:'1.10',quantity:3}]}});assert.equal(row.items[0].lineTotal,'3.30');
});

test('F: critical GitHub bytes preserved; only reversible reviewed corrections permitted',async()=>{
 const {createHash}=await import('node:crypto');
 const preserved=JSON.parse(readFileSync('tests/v5/github-preserved.json','utf8'));
 const reviewed=JSON.parse(readFileSync('tests/hardening/reviewed-source-deltas.json','utf8'));
 for(const [file,sha] of Object.entries(preserved)){
  let content=readFileSync(file);
  if(reviewed[file]){
   assert.equal(createHash('sha256').update(content).digest('hex'),reviewed[file].sha256,file+' reviewed content');
   for(const delta of [...reviewed[file].edits].reverse()){
    const after=Buffer.from(delta.after),before=Buffer.from(delta.before),at=delta.afterByteOffset;
    assert.deepEqual(content.subarray(at,at+after.length),after,'Reviewed bytes present: '+file);
    content=Buffer.concat([content.subarray(0,at),before,content.subarray(at+after.length)]);
   }
  }
  assert.equal(createHash('sha256').update(content).digest('hex'),sha,file+' original untouched bytes');
 }
});
