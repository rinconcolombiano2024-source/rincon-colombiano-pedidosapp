"use strict";
const { test }=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const take=(src,from,to)=>{
  const a=src.indexOf(from); const b=src.indexOf(to,a+from.length);
  assert.ok(a>=0&&b>a,"Missing live source function "+from);return src.slice(a,b);
};
function harness(file){
  const src=read(file),timers=new Map(),handlers=new Map();
  let next=0,directoryReads=0,menuReads=0,resetCount=0;
  const channel={on(_kind,filter,cb){handlers.set(filter.table,cb);return this},subscribe(){return this}};
  const context=vm.createContext({
    customerClient:{channel(){return channel}},
    customerStoreId:"restaurant-1",customerMenuRealtimeStoreId:"",
    customerMenuRealtimeChannel:null,customerMenuRealtimeTimer:null,
    customerDirectoryRealtimeTimer:null,
    customerStopMenuRealtime(){resetCount++},
    customerMenu:{Comidas:[{name:"Arepa"}]},
    customerT:key=>key,customerSetStatus(){},
    customerMenuProductCount:()=>1,
    customerLoadMenu:async opts=>{assert.equal(opts.skipDirectory,true);menuReads++;return true},
    customerLoadRestaurantDirectory:async opts=>{assert.equal(opts.silent,true);directoryReads++;return true},
    document:{visibilityState:"visible"},
    window:{navigator:{onLine:true},setTimeout(fn,ms){const id=++next;timers.set(id,{fn,ms});return id},
      clearTimeout(id){timers.delete(id)}},
    console
  });
  const runnable=take(src,"function customerScheduleDirectoryRefresh() {","function customerScheduleDirectoryPoll(")
    +take(src,"function customerScheduleMenuRealtimeRefetch() {","function customerStartMenuRealtime()")
    +take(src,"function customerStartMenuRealtime() {","function customerMenuProductCount(");
  vm.runInContext(runnable,context);
  context.customerStartMenuRealtime();
  assert.equal(resetCount,1);
  assert.equal(handlers.size,2,"public catalog and profiles subscriptions must remain");
  const fire=async()=>{const entries=[...timers.entries()];timers.clear();for(const [,t] of entries)await t.fn();await Promise.resolve()};
  return {context,timers,handlers,fire,get menuReads(){return menuReads},get directoryReads(){return directoryReads}};
}
for(const file of ["cliente.js","www/cliente.js"]){
  test(file+" 1000 profile events batch into one directory read and one menu read",async()=>{
    const h=harness(file);
    for(let i=0;i<1000;i++)h.handlers.get("restaurant_profiles")({});
    assert.equal(h.directoryReads,0,"no immediate REST requests on Realtime event burst");
    assert.equal(h.menuReads,0);
    assert.equal(h.timers.size,2,"coalesce one directory timer and one menu timer");
    assert.deepEqual([...h.timers.values()].map(x=>x.ms).sort((a,b)=>a-b),[1200,5000]);
    await h.fire();
    assert.equal(h.directoryReads,1);assert.equal(h.menuReads,1);
    h.handlers.get("restaurant_profiles")({});
    await h.fire();
    assert.equal(h.directoryReads,2);assert.equal(h.menuReads,2,"second window must still update");
  });
  test(file+" ignores old restaurant events and hidden/offline browsers",async()=>{
    const h=harness(file);
    h.context.customerStoreId="restaurant-2";
    for(let i=0;i<100;i++)h.handlers.get("restaurant_profiles")({});
    assert.equal(h.timers.size,0);
    h.context.customerStoreId="restaurant-1";
    h.context.document.visibilityState="hidden";
    h.handlers.get("restaurant_profiles")({});
    assert.equal(h.timers.size,0);
    h.context.document.visibilityState="visible";
    h.context.window.navigator.onLine=false;
    h.handlers.get("restaurant_profiles")({});
    assert.equal(h.timers.size,0);
  });
}
