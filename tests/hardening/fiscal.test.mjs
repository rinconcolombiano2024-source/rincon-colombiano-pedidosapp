import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FileJournal} from '../../fiscal-agent/src/file-journal.mjs';
import {FiscalAgent,MemoryJournal} from '../../fiscal-agent/src/agent.mjs';
const id='11111111-1111-4111-8111-111111111111';
const payload={restaurantId:id,orderId:id,currency:'PLN',items:[{name:'Arepa',quantityMilli:1000,grossTotalGrosz:500,taxCode:'8'}],totalGrosz:500};
test('100 concurrent fiscal runs share one claim/print; recovery cannot reconcile an active print',async()=>{
 let claims=0,prints=0,reconciles=0,release;const blocked=new Promise(r=>release=r);
 const client={claim:async()=>{claims++;return {operation_id:id,fiscal_payload:payload};},sending:async()=>{},result:async()=>{}};
 const driver={printReceipt:async()=>{prints++;await blocked;return {operationId:id,status:'confirmed',fiscal:false,simulated:true};},reconcile:async()=>{reconciles++;return {operationId:id,status:'unknown'};}};
 const agent=new FiscalAgent({client,driver,journal:new MemoryJournal()});
 const operations=Array.from({length:100},()=>agent.runOnce());await new Promise(r=>setImmediate(r));
 const recovering=agent.recover();assert.equal(prints,1);assert.equal(claims,1);assert.equal(reconciles,0);
 release();await Promise.all([...operations,recovering]);assert.equal(prints,1);assert.equal(reconciles,0);
});
test('closed journal cannot write or delete a newer process lock',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'rc-lock-'));try{
  const path=join(dir,'journal.json'),first=new FileJournal(path);await first.put({operationId:id,phase:'unknown'});first.close();
  const next=new FileJournal(path);first.close();assert.throws(()=>new FileJournal(path),/LOCKED/);
  await assert.rejects(()=>first.put({operationId:id,phase:'confirmed'}),/CLOSED/);assert.equal((await next.list())[0].phase,'unknown');next.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
