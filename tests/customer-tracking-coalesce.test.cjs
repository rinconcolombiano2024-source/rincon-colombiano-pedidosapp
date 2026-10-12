'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function harness(file){
 const source=fs.readFileSync(file,'utf8');
 const timers=new Map();let next=0,reads=0,read=async()=>true;
 const c=vm.createContext({
  customerTrackingRefreshTimer:null,customerTrackingRefreshPending:false,customerTrackingRefreshGeneration:0,
  customerStatusPollInFlight:null,customerTrackedOrder:{id:'order-1',publicToken:'token-1'},
  customerTrackingRealtimeRetryTimer:null,customerTrackingRealtimeStableTimer:null,
  customerTrackingRealtimeChannel:null,customerTrackingRealtimeSignature:'',customerTrackingRealtimeRow:null,
  customerTrackingRealtimeStatus:'idle',customerClient:{},
  document:{visibilityState:'visible'},window:{navigator:{onLine:true},
   setTimeout(fn,delay){const id=++next;timers.set(id,{fn,delay});return id},clearTimeout(id){timers.delete(id)}},
  customerPollOrderStatus:async()=>{reads++;return read()}
 });
 const start=source.indexOf('function customerStopOrderTrackingRealtime()');
 const end=source.indexOf('function customerStartOrderTrackingRealtime(',start);
 assert.ok(start>=0&&end>start);vm.runInContext(source.slice(start,end),c);
 return {c,timers,get reads(){return reads},set read(fn){read=fn},fire(){const [id,t]=timers.entries().next().value;timers.delete(id);return t.fn()}};
}
for(const file of ['cliente.js','www/cliente.js']){
 test(file+': 1000 updates keep the first deadline and perform one read',async()=>{
  const h=harness(file);h.c.customerScheduleTrackingRefresh();const id=h.c.customerTrackingRefreshTimer;
  for(let i=0;i<1000;i++)h.c.customerScheduleTrackingRefresh();
  assert.equal(h.timers.size,1);assert.equal(h.c.customerTrackingRefreshTimer,id);
  assert.equal(h.timers.get(id).delay,1000);await h.fire();assert.equal(h.reads,1);assert.equal(h.timers.size,0);
 });
 test(file+': events during slow read produce one trailing read, never overlap',async()=>{
  const h=harness(file),gate=deferred();h.read=()=>gate.promise;
  h.c.customerScheduleTrackingRefresh();const running=h.fire();assert.equal(h.reads,1);
  for(let i=0;i<1000;i++)h.c.customerScheduleTrackingRefresh();assert.equal(h.timers.size,0);
  gate.resolve(true);await running;assert.equal(h.timers.size,1);
  h.read=async()=>true;await h.fire();assert.equal(h.reads,2);assert.equal(h.timers.size,0);
 });
 test(file+': existing status request completes before a fresh event reconciliation',async()=>{
  const h=harness(file),gate=deferred();h.c.customerStatusPollInFlight=gate.promise;
  h.c.customerScheduleTrackingRefresh();const running=h.fire();assert.equal(h.reads,0);
  h.c.customerStatusPollInFlight=null;gate.resolve(true);await running;assert.equal(h.reads,1);
 });
 test(file+': rejected existing request still allows reconciliation',async()=>{
  const h=harness(file),gate=deferred();h.c.customerStatusPollInFlight=gate.promise;
  h.c.customerScheduleTrackingRefresh();const running=h.fire();h.c.customerStatusPollInFlight=null;
  gate.reject(Error('offline'));await running;assert.equal(h.reads,1);
 });
 for(const transition of ['hidden','offline','order','token','stop'])test(file+': '+transition+' cancels stale work',async()=>{
  const h=harness(file),gate=deferred();h.c.customerStatusPollInFlight=gate.promise;
  h.c.customerScheduleTrackingRefresh();const running=h.fire();
  if(transition==='hidden')h.c.document.visibilityState='hidden';
  if(transition==='offline')h.c.window.navigator.onLine=false;
  if(transition==='order')h.c.customerTrackedOrder.id='other';
  if(transition==='token')h.c.customerTrackedOrder.publicToken='other';
  if(transition==='stop')h.c.customerStopOrderTrackingRealtime();
  gate.resolve(true);await running;assert.equal(h.reads,0);assert.equal(h.timers.size,0);
 });
 test(file+': old completion cannot erase a new generation timer',async()=>{
  const h=harness(file),gate=deferred();h.read=()=>gate.promise;
  h.c.customerScheduleTrackingRefresh();const running=h.fire();
  h.c.customerStopOrderTrackingRealtime();h.c.customerScheduleTrackingRefresh();
  const id=h.c.customerTrackingRefreshTimer;gate.resolve(true);await running;
  assert.equal(h.c.customerTrackingRefreshTimer,id);assert.equal(h.timers.size,1);
 });
 test(file+': failed read releases scheduler without automatic retry storm',async()=>{
  const h=harness(file);h.read=async()=>{throw Error('network')};
  h.c.customerScheduleTrackingRefresh();await h.fire();assert.equal(h.timers.size,0);
  assert.equal(h.c.customerTrackingRefreshTimer,null);h.read=async()=>true;
  h.c.customerScheduleTrackingRefresh();await h.fire();assert.equal(h.reads,2);
 });
}
