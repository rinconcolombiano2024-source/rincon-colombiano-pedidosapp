"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"app.js"),"utf8");
const start=source.indexOf("let confirmedRestaurantOwnerProfileWrite = null;");
const stop=source.indexOf("function applyRestaurantProfile(",start);
assert.ok(start>0&&stop>start);
const block=source.slice(start,stop);
function harness(){
 const writes=[],roles=[],warnings=[],pending=[];
 let deferred=true,sequence=0;
 const client={from(table){assert.equal(table,"user_profiles");return {upsert(payload){
   writes.push(payload);
   if(!deferred)return Promise.resolve({error:null});
   let resolve;const promise=new Promise(r=>{resolve=r});pending.push(resolve);return promise;
 }}}};
 const ctx=vm.createContext({
  cloudState:{client,user:{id:"owner-A"}},
  restaurantOwnerUserProfilePayload:profile=>({user_id:ctx.cloudState.user.id,full_name:profile.name||"Owner",phone:profile.phone||"",updated_at:String(++sequence)}),
  restaurantProfileFromUserMetadata:()=>({name:"Owner"}),
  activateCurrentUserRole:async(role)=>{roles.push(role)},
  console:{warn:(...args)=>warnings.push(args)}
 });
 vm.runInContext(block,ctx);
 return {ctx,writes,roles,warnings,pending,enableAuto(){deferred=false},finish(error=null){const r=pending.shift();assert.ok(r,"outstanding request");r({error})}};
}
test("100 simultaneous identical owner refreshes issue exactly one upsert",async()=>{
 const h=harness();const p=Array.from({length:100},()=>h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"},{roleAlreadyActive:true}));
 assert.equal(h.writes.length,1);assert.equal(h.pending.length,1);
 h.finish();await Promise.all(p);
 assert.equal(h.writes.length,1);assert.equal(h.warnings.length,0);
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"},{roleAlreadyActive:true});
 assert.equal(h.writes.length,1);
});
test("changed profile serializes after old write; latest profile wins",async()=>{
 const h=harness();
 const a=h.ctx.ensureRestaurantOwnerIdentity({name:"Old"},{roleAlreadyActive:true});
 const b=h.ctx.ensureRestaurantOwnerIdentity({name:"New"},{roleAlreadyActive:true});
 assert.equal(h.writes.length,1,"second change must not race the first");
 h.finish();await a;
 await Promise.resolve();await Promise.resolve();
 assert.equal(h.writes.length,2);assert.equal(h.writes[1].full_name,"New");
 h.finish();await b;
 await h.ctx.ensureRestaurantOwnerIdentity({name:"New"},{roleAlreadyActive:true});
 assert.equal(h.writes.length,2);
});
test("shared failure is not cached, later load retries, role repair always runs",async()=>{
 const h=harness();
 const a=h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"},{roleAlreadyActive:false});
 const b=h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"},{roleAlreadyActive:false});
 assert.equal(h.writes.length,1);
 h.finish({code:"network"});await Promise.all([a,b]);
 assert.equal(h.roles.length,2);assert.equal(h.warnings.length,2);
 h.enableAuto();
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"},{roleAlreadyActive:true});
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"},{roleAlreadyActive:true});
 assert.equal(h.writes.length,2);
});
test("cancel stale pending continuation when owner signs out",async()=>{
 const h=harness();const a=h.ctx.ensureRestaurantOwnerIdentity({name:"Old"},{roleAlreadyActive:true});
 const b=h.ctx.ensureRestaurantOwnerIdentity({name:"New"},{roleAlreadyActive:true});
 h.ctx.cloudState.user={id:"owner-B"};
 h.finish();await Promise.all([a,b]);
 assert.equal(h.writes.length,1);
 h.enableAuto();h.ctx.cloudState.user={id:"owner-A"};
 await h.ctx.ensureRestaurantOwnerIdentity({name:"New"},{roleAlreadyActive:true});
 assert.equal(h.writes.length,2);
});
test("the same audited code is published in Vercel",()=>{
 assert.equal(source,fs.readFileSync(path.join(root,"www/app.js"),"utf8"));
 assert.match(block,/if \(!options\.roleAlreadyActive\) await activateCurrentUserRole\("restaurant_owner"\)/);
});
