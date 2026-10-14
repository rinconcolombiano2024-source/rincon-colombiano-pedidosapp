"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname,"..","cliente.js"),"utf8");
const begin = source.indexOf("function customerDirectoryRegionKey(");
const end = source.indexOf("async function customerSelectRestaurant(",begin);
assert.ok(begin > 0 && end > begin, "Keep directory logic in a known, isolated source range");
const directoryFunctions = source.slice(begin,end);

function harness(){
  const pending=[];
  const renderings=[];
  const list={innerHTML:"previous menu"};
  const client = {
    rpc(name,args){
      assert.equal(name,"get_public_restaurant_directory_by_region");
      return new Promise(resolve=>pending.push({args,resolve}));
    },
    from(){throw Error("Unexpected legacy query");},
  };
  const ctx = vm.createContext({
    customerDirectoryLoadPromise:null,
    customerDirectoryLoadRegionKey:"",
    customerClient:client,
    customerRegistrationRegion:{countryCode:"PL",city:"Warszawa",region:"Mazowieckie"},
    customerElements:{restaurantList:list},
    customerStoreId:"",
    customerEnsureClient:()=>client,
    customerStartDirectoryRealtime:()=>{},
    customerIsMissingRpc:e=>e?.code==="PGRST202",
    customerNormalizeRestaurantProfile:row=>({
      userId:row.user_id,name:row.business_name,countryCode:row.country_code,region:row.region,
    }),
    customerDeduplicateRestaurants:rows=>rows,
    customerNormalizeSearchText:s=>String(s).toLowerCase(),
    customerSelectedRestaurant:()=>null,
    customerClearRestaurantSelection:()=>{throw Error("Unexpected selection deletion");},
    customerRenderRestaurantDirectory:()=>renderings.push(ctx.customerRestaurants.map(x=>x.userId)),
    customerEscapeHtml:s=>s,
    customerT:()=>"...",
    customerRestaurants:[],
    Promise,
  });
  vm.runInContext(directoryFunctions,ctx,{timeout:1000});
  const respond=(index,data,error=null)=>{
    assert.ok(pending[index],"Expected pending RPC "+index);
    pending[index].resolve({data,error});
  };
  return {ctx,pending,renderings,list,
    load:(options={silent:true})=>ctx.customerLoadRestaurantDirectory(options),
    region:region=>{ctx.customerRegistrationRegion={...region};},
    respond,
  };
}
const restaurant=(user_id,country_code,region)=>({
  user_id,business_name:"Restaurante "+user_id,country_code,region,
});

test("changing country mid-flight cannot show results from the previous country",async()=>{
  const h=harness();
  const first=h.load();
  assert.equal(h.pending.length,1);
  assert.equal(h.pending[0].args.p_country_code,"PL");
  h.region({countryCode:"CO",city:"Bogotá",region:"Cundinamarca"});
  const second=h.load();
  assert.equal(h.pending.length,1,"Only one flight while the first is still running");
  h.respond(0,[restaurant("old-PL","PL","Mazowieckie")]);
  assert.equal(await first,false);
  // Promise chaining launches a fresh request for the latest region.
  await Promise.resolve();
  assert.equal(h.pending.length,2);
  assert.equal(h.pending[1].args.p_country_code,"CO");
  assert.equal(h.pending[1].args.p_city,"Bogotá");
  assert.deepEqual(h.renderings,[],"Old response must not render");
  h.respond(1,[restaurant("new-CO","CO","Cundinamarca")]);
  assert.equal(await second,true);
  assert.deepEqual(h.renderings,[["new-CO"]]);
});

test("same-region callers continue sharing one RPC",async()=>{
  const h=harness();
  const [first,second]=[h.load(),h.load()];
  assert.equal(h.pending.length,1);
  assert.strictEqual(first,second);
  h.respond(0,[restaurant("PL-only","PL","Mazowieckie")]);
  assert.equal(await first,true);
  assert.equal(await second,true);
  assert.deepEqual(h.renderings,[["PL-only"]]);
});

test("stale network failure never replaces the new region with an error message",async()=>{
  const h=harness();
  const first=h.load();
  h.region({countryCode:"CO",city:"Cali",region:"Valle del Cauca"});
  const second=h.load();
  h.respond(0,null,{message:"SERVICE_UNAVAILABLE"});
  assert.equal(await first,false);
  assert.equal(h.list.innerHTML,"previous menu");
  await Promise.resolve();
  h.respond(1,[restaurant("Cali","CO","Valle del Cauca")]);
  await second;
  assert.deepEqual(h.renderings,[["Cali"]]);
});

test("a late result from a replaced API client cannot mutate customer UI",async()=>{
  const h=harness();
  const result=h.load();
  h.ctx.customerClient={};
  h.respond(0,[restaurant("previous-account","PL","Mazowieckie")]);
  assert.equal(await result,false);
  assert.deepEqual(h.renderings,[]);
});

test("region changes during the legacy missing-RPC fallback cannot update the list",async()=>{
  const h=harness();
  let unblockFallback;
  let fallbackStarted;
  const fallbackReady=new Promise(resolve=>{fallbackStarted=resolve;});
  const fallback=new Promise(resolve=>{unblockFallback=resolve;});
  const filters=[];
  const chain={
    select(){return this;},eq(...args){filters.push(args);return this;},
    is(){return this;},ilike(...args){filters.push(args);return this;},
    order(){fallbackStarted();return fallback;},
  };
  const existing=h.ctx.customerClient;
  existing.from=table=>{assert.equal(table,"restaurant_profiles");return chain;};
  const first=h.load();
  h.respond(0,null,{code:"PGRST202"});
  // Wait until the legacy fallback is genuinely awaiting a response.
  await fallbackReady;
  h.region({countryCode:"CO",city:"Bogotá",region:"Cundinamarca"});
  const second=h.load();
  unblockFallback({data:[restaurant("old","PL","Mazowieckie")],error:null});
  assert.equal(await first,false);
  assert.ok(filters.some(f=>f[1]==="PL"));
  assert.deepEqual(h.renderings,[]);
  await Promise.resolve();
  h.respond(1,[restaurant("new","CO","Cundinamarca")]);
  await second;
  assert.deepEqual(h.renderings,[["new"]]);
});
