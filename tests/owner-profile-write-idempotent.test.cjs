"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"app.js"),"utf8");
const start=source.indexOf("// Cache only confirmed profile writes in this page session.");
const end=source.indexOf("function applyRestaurantProfile(",start);
assert.ok(start>=0 && end>start,"actual confirmed owner profile upsert block exists");
const block=source.slice(start,end);
let tick=0;
function harness(){
  const calls=[], roles=[],warnings=[];
  let failure=null, deferred=null;
  const client={from(name){assert.equal(name,"user_profiles");return {upsert(payload){
    calls.push(payload); if(deferred){const f=deferred;deferred=null;return f}return Promise.resolve({error:failure});
  }}}};
  const ctx=vm.createContext({
    cloudState:{client,user:{id:"owner-A"}},
    restaurantOwnerUserProfilePayload:profile=>({user_id:ctx.cloudState.user.id,full_name:profile.name||"Owner",phone:profile.phone||"",status:"active",updated_at:"2026-10-13T00:00:"+String(++tick).padStart(2,"0")+"Z"}),
    restaurantProfileFromUserMetadata:()=>({name:"Owner"}),
    activateCurrentUserRole:async role=>{roles.push(role)},
    console:{warn(...args){warnings.push(args)}}
  });
  vm.runInContext(block,ctx);
  return {ctx,client,calls,roles,warnings,setFailure(error){failure=error},defer(p){deferred=p}};
}
test("identical owner registration produces only one UPDATE in same session",async()=>{
 const h=harness();
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 assert.equal(h.calls.length,1);assert.equal(h.roles.length,0);
});
test("profile changes are persisted and repaired roles remain independent",async()=>{
 const h=harness();
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner",phone:"123"}, {roleAlreadyActive:false});
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner",phone:"123"}, {roleAlreadyActive:false});
 assert.equal(h.calls.length,2);
 assert.equal(h.roles.length,2);
});
test("failed upsert never caches success; next server load retries",async()=>{
 const h=harness();h.setFailure({code:"42501"});
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 h.setFailure(null);
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 assert.equal(h.calls.length,2);assert.equal(h.warnings.length,1);
});
test("new user or client forces a new upsert",async()=>{
 const h=harness();await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 h.ctx.cloudState.user={id:"owner-B"};
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 h.ctx.cloudState.client=harness().client;
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 assert.equal(h.calls.length,2);
});
test("successful stale response after signout cannot populate identity cache",async()=>{
 const h=harness();let finish;
 h.defer(new Promise(resolve=>{finish=resolve;}));
 const pending=h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 h.ctx.cloudState.user={id:"owner-B"};
 finish({error:null});await pending;
 h.ctx.cloudState.user={id:"owner-A"};
 await h.ctx.ensureRestaurantOwnerIdentity({name:"Owner"}, {roleAlreadyActive:true});
 assert.equal(h.calls.length,2);
});
test("root & www app files match, legacy role repair preserved",()=>{
 assert.equal(source,fs.readFileSync(path.join(root,"www/app.js"),"utf8"));
 assert.match(block,/if \(!options\.roleAlreadyActive\) await activateCurrentUserRole\("restaurant_owner"\)/);
});
