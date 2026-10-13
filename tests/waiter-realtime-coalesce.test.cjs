"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const load=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
function portion(s,a,b){const x=s.indexOf(a),y=s.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,a+" section");return s.slice(x,y);}
function harness(file){
  const s=load(file);
  const callbacks=new Map(),timers=new Map();
  let count=0,menu=0,orders=0,toasts=0,canceled=0;
  let subscribed=null;
  const channel={on(kind,filter,cb){callbacks.set(filter.table,cb);return channel},subscribe(cb){subscribed=cb;return channel}};
  const state=vm.createContext({
    waiterClient:{channel:()=>channel},
    waiterStoreId:"restaurant-1",waiterUser:{id:"employee-1"},
    waiterMembership:{station:"waiter"},waiterOrdersChannel:null,waiterMenuChannel:null,
    waiterOrdersRealtimeStatus:"idle",
    waiterRealtimeMenuRefreshTimer:null,waiterRealtimeSentOrdersRefreshTimer:null,
    waiterStopRealtime(){state.waiterOrdersRealtimeStatus="idle";state.waiterMenuChannel=null;state.waiterOrdersChannel=null},
    waiterLoadMenu:async()=>{menu++;return true},
    waiterLoadSentOrders:async()=>{orders++;return true},
    waiterShowToast:()=>{toasts++},
    window:{setTimeout(cb,ms){let id=++count;timers.set(id,{cb,ms});return id},clearTimeout(id){canceled++;timers.delete(id)}},
    navigator:{onLine:true},console:{error(e){throw e}},
    WAITER_REALTIME_STABLE_MS:15000,WAITER_REALTIME_RECONNECT_MIN_MS:1000,
    waiterRealtimeReconnectDelay:1000,waiterRealtimeStableTimer:null,
    waiterStationPollingDelay:0,WAITER_STATION_POLL_MIN_MS:3000
  });
  const helper=portion(s,"function waiterScheduleLiveSummaryRefresh(scope) {","function waiterScheduleRealtimeReconnect()");
  const realtime=portion(s,"function waiterStartRealtime() {","function waiterChangeStation()");
  vm.runInContext(helper+"\n"+realtime,state);
  state.waiterStartRealtime();
  assert.equal(callbacks.size,2);
  assert.equal(typeof subscribed,"function");
  state.waiterOrdersRealtimeStatus="SUBSCRIBED"; // tests intentionally skip initial SUBSCRIBED catch-up
  return {state,callbacks,timers,async run(){const batch=[...timers.entries()];timers.clear();for(const [,item] of batch)item.cb();await Promise.resolve();await Promise.resolve()},get menu(){return menu},get orders(){return orders},get toasts(){return toasts},get canceled(){return canceled}};
}
for (const file of ["mesero.js","www/mesero.js"]){
  test(file+" 1000 menu and 1000 order events produce only two bounded fetches",async()=>{
    const h=harness(file);
    for(let i=0;i<1000;i++){h.callbacks.get("restaurant_public_catalogs")({});h.callbacks.get("customer_orders")({});}
    assert.equal(h.timers.size,2);
    assert.deepEqual([...h.timers.values()].map(x=>x.ms),[1000,1000]);
    assert.equal(h.menu,0);assert.equal(h.orders,0);assert.equal(h.canceled,0);
    await h.run();
    assert.equal(h.menu,1);assert.equal(h.orders,1);assert.equal(h.toasts,1);
    h.callbacks.get("customer_orders")({});
    await h.run();
    assert.equal(h.orders,2,"a later event must still refresh");
  });
  test(file+" changing account, restaurant or channel discards stale requests",async()=>{
    const h=harness(file);
    h.callbacks.get("customer_orders")({});
    h.state.waiterUser={id:"employee-2"};
    await h.run();assert.equal(h.orders,0);
    h.state.waiterUser={id:"employee-1"};
    h.callbacks.get("restaurant_public_catalogs")({});
    h.state.waiterStoreId="restaurant-2";
    await h.run();assert.equal(h.menu,0);
    h.state.waiterStoreId="restaurant-1";
    h.callbacks.get("customer_orders")({});
    h.state.navigator.onLine=false;
    await h.run();assert.equal(h.orders,0);
  });
  test(file+" removes queued work when a Realtime stream stops",()=>{
    const s=load(file);
    const stop=portion(s,"function waiterStopRealtime() {","function waiterScheduleLiveSummaryRefresh(scope)");
    assert.match(stop,/clearTimeout\(waiterRealtimeMenuRefreshTimer\)/);
    assert.match(stop,/clearTimeout\(waiterRealtimeSentOrdersRefreshTimer\)/);
  });
}
test("root and Vercel/Android waiter files remain byte-identical",()=>assert.equal(load("mesero.js"),load("www/mesero.js")));
