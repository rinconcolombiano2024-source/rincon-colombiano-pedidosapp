"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const script=read("station-menu-resume.js");

function makeHarness() {
  let clock=60_000, reads=0, online=true, visible="hidden", member="cashier", authorized=false, loading=false;
  const docListeners={},winListeners={};
  const vars={waiterClient:{},waiterUser:{id:"test"},waiterStoreId:"store",waiterMembership:{station:"cashier"},
    waiterAuthorizeInFlight:false,waiterMenuLoadInFlight:null, waiterLoadMenu:()=>{reads++;return Promise.resolve()},console:{warn:()=>{}},
    navigator:{get onLine(){return online}},
    document:{get visibilityState(){return visible},addEventListener:(k,fn)=>docListeners[k]=fn},
    window:{addEventListener:(k,fn)=>winListeners[k]=fn},Date:{now:()=>clock}};
  const ctx=vm.createContext(vars);
  vm.runInContext(script,ctx);
  return {ctx,fire:()=>docListeners.visibilitychange(),focus:()=>winListeners.focus(),count:()=>reads,
   clock:n=>clock=n,visibility:v=>visible=v,online:v=>online=v,station:v=>ctx.waiterMembership={station:v},
   authorize:v=>ctx.waiterAuthorizeInFlight=v,loading:v=>ctx.waiterMenuLoadInFlight=v?Promise.resolve():null};
}

test("cashier returning after sleep refreshes published menu once, without polling",()=>{
  const h=makeHarness();
  h.fire();assert.equal(h.count(),0);
  h.visibility("visible");h.fire();assert.equal(h.count(),1);
  h.focus();h.fire();assert.equal(h.count(),1);
  h.clock(79_999);h.fire();assert.equal(h.count(),1);
  h.clock(80_001);h.focus();assert.equal(h.count(),2);
  assert.doesNotMatch(script,/(setInterval|setTimeout|\.rpc\(|\.from\()/);
});

test("offline, unauthorized and non-POS stations never generate extra menu reads",()=>{
  const h=makeHarness();
  h.visibility("visible");h.online(false);h.fire();assert.equal(h.count(),0);
  h.online(true);h.station("kitchen");h.fire();assert.equal(h.count(),0);
  h.station("cashier");h.authorize(true);h.fire();assert.equal(h.count(),0);
  h.authorize(false);h.loading(true);h.fire();assert.equal(h.count(),0);
  h.loading(false);h.fire();assert.equal(h.count(),1);
});

test("source and Android distribution are equal and old cart/station runtime untouched",()=>{
  assert.equal(read("www/station-menu-resume.js"),script);
  assert.equal(read("mesero.js"),read("www/mesero.js"));
  for(const file of ["mesero.html","www/mesero.html"]){
    assert.match(read(file),/station-menu-resume\.js\?v=91\.0\.4-focus1/);
  }
  assert.match(read("scripts/prepare-capacitor.mjs"),/"station-menu-resume\.js"/);
});
