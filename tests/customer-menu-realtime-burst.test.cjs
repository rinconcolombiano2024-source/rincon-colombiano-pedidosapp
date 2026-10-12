"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
function menuHarness(file){
  const source=fs.readFileSync(path.join(__dirname,"..",file),"utf8");
  const start=source.indexOf("function customerScheduleMenuRealtimeRefetch() {");
  const end=source.indexOf("function customerStartMenuRealtime()",start);
  assert.ok(start>=0 && end>start,"actual realtime refresh function exists");
  let seq=0,reads=0,cancels=0,updates=0;
  const timers=new Map();
  const context=vm.createContext({
    customerStoreId:"restaurant-1",
    customerClient:{},
    customerMenuRealtimeTimer:null,
    customerMenu:{foods:[1]},
    document:{visibilityState:"visible"},
    window:{
      navigator:{onLine:true},
      setTimeout(fn,delay){const id=++seq;timers.set(id,{fn,delay});return id},
      clearTimeout(id){cancels++;timers.delete(id)}
    },
    customerLoadMenu:async opts=>{assert.equal(opts.skipDirectory,true);assert.equal(opts.fromRealtime,true);reads++},
    customerMenuProductCount:menu=>menu.foods.length,
    customerT:key=>key,
    customerSetStatus:()=>{updates++},
    console:{error:()=>{throw Error("unexpected error")}}
  });
  vm.runInContext(source.slice(start,end),context,{filename:file});
  return {
    context,timers,
    get reads(){return reads},get cancels(){return cancels},get updates(){return updates},
    async fire(){const entry=timers.entries().next().value;assert.ok(entry,"expected a refresh timer");timers.delete(entry[0]);await entry[1].fn()}
  };
}
for(const file of ["cliente.js","www/cliente.js"]){
  test(file+" 1000 menu change events -> one fetch scheduled, no starvation",async()=>{
    const h=menuHarness(file);
    for(let i=0;i<1000;i++)h.context.customerScheduleMenuRealtimeRefetch();
    assert.equal(h.timers.size,1);
    assert.equal(h.cancels,0);
    assert.equal([...h.timers.values()][0].delay,1200);
    await h.fire();
    assert.equal(h.reads,1);
    assert.equal(h.updates,1);
    h.context.customerScheduleMenuRealtimeRefetch();
    assert.equal(h.timers.size,1,"next burst can refresh");
    await h.fire();
    assert.equal(h.reads,2);
  });
  test(file+" hidden/offline do not fetch menu; store reset skips traffic",async()=>{
    const h=menuHarness(file);
    h.context.document.visibilityState="hidden";
    for(let i=0;i<100;i++)h.context.customerScheduleMenuRealtimeRefetch();
    assert.equal(h.timers.size,0);
    h.context.document.visibilityState="visible";
    h.context.window.navigator.onLine=false;
    h.context.customerScheduleMenuRealtimeRefetch();
    assert.equal(h.timers.size,0);
    h.context.window.navigator.onLine=true;
    h.context.customerScheduleMenuRealtimeRefetch();
    h.context.customerStoreId="";
    await h.fire();
    assert.equal(h.reads,0,"timer must not load after store change");
  });
}
