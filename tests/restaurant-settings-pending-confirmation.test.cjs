"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
const start = source.indexOf("async function saveSettingsWhenPossible(options = {}) {");
const end = source.indexOf("async function saveMenuWhenPossibleNow(options = {}) {",start);
assert.ok(start >= 0 && end > start, "Settings save must retain its known isolated boundary");
const functionSource = source.slice(start,end);

function harness({initialToken="edit-1",online=true,clientReady=true}={}){
  let pending=initialToken, saveResult;
  const messages=[];
  let resolveCloud, rejectCloud;
  const cloudPromise=new Promise((resolve,reject)=>{resolveCloud=resolve;rejectCloud=reject;});
  const context=vm.createContext({
    cloudState:{user:clientReady?{id:"restaurant-test"}:null},
    navigator:{onLine:online},
    currentSettingsPendingToken:()=>pending,
    clearSettingsPending:token=>{
      if(token && pending!==token)return false;
      pending=null;
      return true;
    },
    hasPendingSettings:()=>Boolean(pending),
    markSettingsPending:()=>{pending="retry-queued";return pending;},
    shouldQueueForCloud:()=>true,
    saveCloudSettings:()=>cloudPromise,
    withCloudTimeout:promise=>promise,
    updateCloudStatus:text=>{messages.push(text??"");},
    console:{error:()=>{}},
  });
  vm.runInContext(functionSource,context,{timeout:1000});
  return {
    save:options=>context.saveSettingsWhenPossible(options),
    finish:(value={settingsRevision:4})=>{saveResult=value;resolveCloud(value);},
    fail:error=>rejectCloud(error),
    edit:token=>{pending=token;},
    pending:()=>pending,
    status:()=>messages.at(-1),
    history:()=>messages,
  };
}

test("settings: saved revision clears unchanged pending journal and acknowledges cloud",async()=>{
  const h=harness();
  const attempt=h.save();
  h.finish();
  const result=await attempt;
  assert.equal(result.synced,true);
  assert.equal(h.pending(),null);
  assert.equal(h.status(),"Sincronizado");
});

test("settings: newer edit during cloud request cannot be discarded or reported synced",async()=>{
  const h=harness();
  const attempt=h.save();
  h.edit("edit-2");
  h.finish();
  const result=await attempt;
  assert.equal(result.pending,true);
  assert.equal(result.synced,undefined);
  assert.equal(h.pending(),"edit-2");
  assert.equal(h.status(),"Ajustes pendientes de sincronización");
});

test("settings: two confirmations of the same edition do not invent a pending edit",async()=>{
  const h=harness();
  const first=h.save();
  const second=h.save();
  h.finish();
  const results=await Promise.all([first,second]);
  assert.ok(results.every(result=>result.synced===true));
  assert.equal(h.pending(),null);
  assert.equal(h.status(),"Sincronizado");
});

test("settings: edit queued during request that started without pending token stays visible",async()=>{
  const h=harness({initialToken:null});
  const attempt=h.save();
  h.edit("new-pending");
  h.finish();
  const result=await attempt;
  assert.equal(result.pending,true);
  assert.equal(h.pending(),"new-pending");
});

test("settings: failed cloud save never clears pending state or claims success",async()=>{
  const h=harness();
  const attempt=h.save();
  h.fail(new Error("RPC_FAILED"));
  const result=await attempt;
  assert.ok(result.error);
  assert.equal(result.synced,undefined);
  assert.ok(h.pending());
  assert.notEqual(h.status(),"Sincronizado");
});

test("settings: offline and missing-session saves stay queued without cloud calls",async()=>{
  for(const options of [{online:false},{clientReady:false}]){
    const h=harness(options);
    const result=await h.save();
    assert.equal(result.pending,true);
    assert.ok(h.pending());
  }
});
