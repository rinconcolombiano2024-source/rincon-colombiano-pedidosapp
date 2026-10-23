"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const vm=require("node:vm");

const source=readFileSync("app.js","utf8");
assert.equal(source,readFileSync("www/app.js","utf8"),"Android and browser must use the same state confirmation");
const start=source.indexOf("async function persistRestaurantOperationalOpenInCloud(");
const end=source.indexOf("function setRestaurantStatusControlsDisabled(",start);
assert.ok(start>=0 && end>start,"real restaurant opening handler exists");
const handler=source.slice(start,end);
function setup(response,afterRpc){
 let rpcCalls=0,extraReads=0,requested=[];
 const owner="restaurant-a";
 const client={
  rpc:async(name,params)=>{
   rpcCalls++;requested.push({name,params});
   if(afterRpc)afterRpc(ctx);
   return typeof response==="function"?response():response;
  },
  from:()=>{extraReads++;throw new Error("secondary SELECT failed despite successful commit");}
 };
 const ctx={cloudState:{client,user:{id:owner}}};
 vm.createContext(ctx);
 vm.runInContext(handler,ctx);
 return {ctx,run:x=>ctx.persistRestaurantOperationalOpenInCloud(x),calls:()=>({rpcCalls,extraReads,requested})};
}
for(const state of [true,false])test("manual "+(state?"open":"close")+" confirms committed row without redundant SQL SELECT",async()=>{
 const response={data:[{restaurant_user_id:"restaurant-a",operational_open:state,changed_at:"2026-10-23T12:00:00Z"}],error:null};
 const h=setup(response);
 const row=await h.run(state);
 assert.equal(row.operational_open,state);
 assert.equal(h.calls().rpcCalls,1);
 assert.equal(h.calls().extraReads,0);
 assert.equal(h.calls().requested[0].name,"set_current_restaurant_operational_open");
 assert.equal(h.calls().requested[0].params.p_open,state);
});
for(const [label,response] of [
 ["wrong tenant",{data:[{restaurant_user_id:"restaurant-b",operational_open:true}],error:null}],
 ["wrong committed state",{data:[{restaurant_user_id:"restaurant-a",operational_open:false}],error:null}],
 ["empty response",{data:[],error:null}],
 ["multiple rows",{data:[{restaurant_user_id:"restaurant-a",operational_open:true},{restaurant_user_id:"restaurant-a",operational_open:true}],error:null}],
 ["missing response",{data:null,error:null}]
])test(label+" refuses to confirm opening",async()=>{
 const h=setup(response);
 await assert.rejects(h.run(true),/La nube no confirmo/);
 assert.equal(h.calls().extraReads,0);
});
test("authenticated session changing while RPC is in-flight cannot confirm stale tenant state",async()=>{
 const h=setup({data:[{restaurant_user_id:"restaurant-a",operational_open:true}],error:null},ctx=>{ctx.cloudState.user={id:"restaurant-b"};});
 await assert.rejects(h.run(true),/La nube no confirmo/);
});
test("RPC errors still refuse opening and cannot trigger additional writes",async()=>{
 const h=setup({data:null,error:{message:"DB_BUSY",code:"XX000"}});
 await assert.rejects(h.run(true),e=>e.code==="XX000");
 assert.equal(h.calls().rpcCalls,1);
 assert.equal(h.calls().extraReads,0);
});
test("other operational mode verification retains its independent existing read",()=>{
 assert.match(source,/async function persistRestaurantOperationalModeInCloud/);
 assert.match(source,/return verifyRestaurantOperationalOpenInCloud\(result\.operational_open === true, expectedMode\)/);
});
