"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
assert.equal(app,fs.readFileSync(path.join(root,"www/app.js"),"utf8"),"Web and Android must have identical guarded cloud menu writes");
const start=app.indexOf("// One in-flight Supabase menu RPC");
const end=app.indexOf("async function saveCloudMenuRequest()",start);
assert.ok(start>0&&end>start,"Shared cloud single-flight guard must be present");
const wrapper=app.slice(start,end);
function harness(){
  const state={client:{},user:{id:"one"}};
  const operations=[];
  const ctx=vm.createContext({
    cloudState:state,Error,Promise,
    saveCloudMenuRequest:()=>{
      let resolve,reject;
      const promise=new Promise((a,b)=>{resolve=a;reject=b});
      operations.push({resolve,reject,promise});
      return promise;
    }
  });
  vm.runInContext(wrapper,ctx);
  return {ctx,state,operations,save:()=>ctx.saveCloudMenu()};
}
test("100 concurrent QR/editor/background saves produce one Supabase RPC",async()=>{
  const h=harness();
  const requests=Array.from({length:100},()=>h.save());
  assert.equal(h.operations.length,1);
  h.operations[0].resolve({menuRevision:42,localChangesPending:false});
  const results=await Promise.all(requests);
  assert.equal(results.length,100);
  assert.ok(results.every(result=>result.menuRevision===42));
  assert.equal(h.operations.length,1);
});
test("A new restaurant never inherits an old restaurant's in-flight publication",async()=>{
  const h=harness(),pending=h.save();
  h.state.user={id:"two"};
  await assert.rejects(h.save(),error=>error.code==="RC_ORDERA_MENU_SESSION_CHANGED");
  assert.equal(h.operations.length,1);
  h.operations[0].resolve({menuRevision:2});
  await pending;
  const next=h.save();
  assert.equal(h.operations.length,2,"new account can publish only after old flight settled");
  h.operations[1].resolve({menuRevision:1});
  assert.equal((await next).menuRevision,1);
});
test("Missing Supabase client is never reported as a successful menu publication",async()=>{
  const h=harness();
  h.state.client=null;
  await assert.rejects(h.save(),error=>error.code==="RC_ORDERA_MENU_SESSION_REQUIRED");
  assert.equal(h.operations.length,0);
});
test("Rejected RPC does not trigger automatic retries or leave a permanent lock",async()=>{
  const h=harness();
  const first=h.save(),second=h.save();
  assert.equal(h.operations.length,1);
  h.operations[0].reject(new Error("network failure"));
  await assert.rejects(first,/network failure/);
  await assert.rejects(second,/network failure/);
  assert.equal(h.operations.length,1,"No blind retry of failed financial/menu RPC");
  const next=h.save();
  assert.equal(h.operations.length,2);
  h.operations[1].resolve({menuRevision:3});
  assert.equal((await next).menuRevision,3);
});
test("No recurring timer, queue deletion or new RLS bypass introduced",()=>{
  assert.doesNotMatch(wrapper,/setInterval\s*\(|setTimeout\s*\(|localStorage\.(removeItem|clear)\s*\(|service_role|auth\.uid/);
});
