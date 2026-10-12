'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
for(const file of ['app.js','www/app.js']){
 test(file+' consumes both outcomes of pending data sync without orphan promise',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const begin=src.indexOf('function syncPendingData(options');
  assert.ok(begin>=0);
  const block=src.slice(begin,src.indexOf('function schedulePendingDataSyncRetry(',begin));
  assert.match(block,/operation\.then\(clearPendingSync, clearPendingSync\)/);
  assert.doesNotMatch(block,/operation\.finally\(/);
  assert.match(block,/pendingDataSyncInFlight === operation/);
 });
}
