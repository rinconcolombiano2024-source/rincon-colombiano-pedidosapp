import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileJournal } from '../src/file-journal.mjs';
import { FiscalAgent } from '../src/agent.mjs';
function fixture(t, initial) {
  const dir=mkdtempSync(join(tmpdir(),'rc-journal-')), path=join(dir,'journal.json');
  if(initial!==undefined)writeFileSync(path,initial);
  const journal=new FileJournal(path);
  t.after(()=>{journal.close();rmSync(dir,{recursive:true,force:true});});
  return {journal,path};
}
test('corrupt journal refuses reads and writes without replacing evidence',async t=>{
  const {journal,path}=fixture(t);
  for(const raw of ['[]','null','7','{','{"op":null}','{"op":{"operationId":"other","phase":"unknown"}}','{"op":{"operationId":"op","phase":"other"}}']) {
    writeFileSync(path,raw);
    await assert.rejects(journal.list(),/JOURNAL_(INVALID|UNREADABLE)/);
    await assert.rejects(journal.put({operationId:'new',phase:'sending'}),/JOURNAL_/);
    await assert.rejects(journal.remove('op'),/JOURNAL_/);
    assert.equal(readFileSync(path,'utf8'),raw);
  }
});
test('special object keys persist as ordinary operation identities across restart',async t=>{
  const {journal,path}=fixture(t);
  for(const operationId of ['__proto__','constructor','op'])await journal.put({operationId,phase:'unknown'});
  journal.close();const next=new FileJournal(path);
  try {
  assert.deepEqual((await next.list()).map(e=>e.operationId).sort(),['__proto__','constructor','op']);
  await next.remove('__proto__');assert.equal((await next.list()).length,2);
  } finally { next.close(); }
});
test('disappearing journal fails closed during the same process',async t=>{
  const {journal,path}=fixture(t);
  await journal.put({operationId:'op',phase:'unknown'});unlinkSync(path);
  await assert.rejects(journal.list(),/JOURNAL_MISSING/);
  await assert.rejects(journal.put({operationId:'new',phase:'sending'}),/JOURNAL_MISSING/);
});
test('invalid new states cannot overwrite a durable operation',async t=>{
  const {journal,path}=fixture(t);await journal.put({operationId:'op',phase:'unknown'});
  const before=readFileSync(path,'utf8');
  for(const e of [null,{operationId:'',phase:'sending'},{operationId:'op',phase:'result'},{operationId:'op',phase:'unknown',outcome:'confirmed'}])await assert.rejects(journal.put(e),/JOURNAL_INVALID/);
  assert.equal(readFileSync(path,'utf8'),before);
});
test('agent cannot claim or print with a corrupt persistent journal',async t=>{
  const {journal}=fixture(t,'[]');let calls=0;
  const agent=new FiscalAgent({journal,client:{claim:async()=>{calls++;}},driver:{printReceipt:async()=>{calls++;}}});
  await assert.rejects(agent.runOnce(),/JOURNAL_INVALID/);assert.equal(calls,0);
});
