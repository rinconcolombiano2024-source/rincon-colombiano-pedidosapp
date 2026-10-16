"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const vm = require("node:vm");

const source=readFileSync(join(__dirname,"..","app.js"),"utf8");
function body(start,end){
  const first=source.indexOf(start),last=source.indexOf(end,first);
  assert.ok(first>=0&&last>first,"Required source boundaries missing: "+start);
  return source.slice(first,last);
}
const cloudFn=body("async function saveCloudSettings() {","function isMenuRevisionConflict(error) {");
const possibleFn=body("async function saveSettingsWhenPossible(options = {}) {","async function saveMenuWhenPossibleNow(options = {}) {");

function setup(){
  let token="edition-1", local="original", profile="original", confirmedBase=null, revision=3, reads=0;
  const requests=[],applied=[],history=[];
  const firstClient={rpc(name,args){
    assert.equal(name,"save_current_restaurant_settings");
    return new Promise(resolve=>{requests.push({args,resolve});});
  }};
  const state={client:firstClient,user:{id:"rest-1"}};
  const context=vm.createContext({
    cloudState:state,
    businessLogoUrl:"https://cdn.example.test/logo.jpg",
    navigator:{onLine:true},
    STORAGE_KEYS:{settingsRevision:"revision"},
    isInlineRestaurantImage:()=>false,
    currentSettingsPendingToken:()=>token,
    hasPendingSettings:()=>Boolean(token),
    currentSettingsPayload:()=>({displayName:local}),
    currentRestaurantRpcProfilePayload:()=>({businessName:local}),
    storedCloudRevision:()=>revision,
    storeCloudRevision:(_key,next)=>{revision=next;},
    storeConfirmedCloudSettings:data=>{confirmedBase=data;},
    readConfirmedCloudSettings:()=>confirmedBase,
    readCurrentCloudSettingsRow:()=>{reads++;return {settings:{displayName:"remote"},settings_revision:5};},
    mergeConcurrentSettingsChanges:(base,current,remote)=>({...remote,...current}),
    applySettingsPayload:data=>{local=data.displayName;applied.push("settings");},
    applyPublicRestaurantProfileFallback:data=>{profile=data.businessName;applied.push("profile");},
    isMissingRestaurantRpc:()=>false,
    appUiText:s=>s,
    shouldQueueForCloud:()=>true,
    markSettingsPending:()=>{token="requeued";return token;},
    clearSettingsPending:(old)=>{if(token!==old)return false;token=null;return true;},
    withCloudTimeout:p=>p,
    saveCloudSettings:undefined,
    updateCloudStatus:s=>history.push(s),
    console:{error:()=>{}},
  });
  vm.runInContext(cloudFn+"\n"+possibleFn,context,{timeout:1000});
  return {
    save:()=>context.saveCloudSettings(),
    saveWithStatus:()=>context.saveSettingsWhenPossible(),
    requests,applied,state,firstClient,
    get:()=>({token,local,profile,confirmedBase,revision,reads,history}),
    edit:(value,newToken)=>{local=value;token=newToken;},
    switchRestaurant:()=>{state.client={};state.user={id:"rest-2"};},
    reply:(index,{name="original",number=4,error=null}={})=>{
      requests[index].resolve({data:error?null:{settings:{displayName:name},profile:{businessName:name},settingsRevision:number},error});
    },
  };
}
test("normal cloud confirmation still updates local settings and revision",async()=>{
  const h=setup();const p=h.save();
  assert.equal(h.requests.length,1);
  h.reply(0,{name:"server-confirmed"});
  await p;
  assert.deepEqual(h.applied,["settings","profile"]);
  assert.equal(h.get().local,"server-confirmed");
  assert.equal(h.get().revision,4);
});
test("late confirmation preserves newer local edit but keeps authoritative remote revision for next save",async()=>{
  const h=setup();const p=h.save();
  assert.equal(h.requests[0].args.p_settings.displayName,"original");
  h.edit("newer","edition-2");
  h.reply(0,{name:"original",number:7});
  await p;
  assert.equal(h.get().local,"newer");
  assert.equal(h.get().profile,"original");
  assert.equal(h.get().token,"edition-2");
  assert.equal(h.get().revision,7);
  assert.equal(h.get().confirmedBase.displayName,"original");
  assert.deepEqual(h.applied,[]);
});
test("late confirmation cannot apply values or cloud revisions to another restaurant",async()=>{
  const h=setup();const p=h.save();
  h.switchRestaurant();h.reply(0,{name:"old-owner",number:99});
  await assert.rejects(p,{code:"SETTINGS_SESSION_CHANGED"});
  assert.deepEqual(h.applied,[]);
  assert.equal(h.get().revision,3);
  assert.equal(h.get().confirmedBase,null);
});
test("conflict with a newer edit never merges or retries a stale snapshot",async()=>{
  const h=setup();const p=h.save();h.edit("newer","edition-2");
  h.reply(0,{error:{message:"SETTINGS_REVISION_CONFLICT"}});
  await assert.rejects(p,{code:"SETTINGS_CONCURRENT_EDIT_PENDING"});
  assert.equal(h.requests.length,1);
  assert.equal(h.get().reads,0);
  assert.equal(h.get().local,"newer");
});
test("settings error from signed-out restaurant cannot queue a token into next tenant",async()=>{
  const h=setup();const p=h.saveWithStatus();
  h.switchRestaurant();h.reply(0,{name:"old-owner"});
  const result=await p;
  assert.equal(result.pending,false);
  assert.equal(result.error?.code,"SETTINGS_SESSION_CHANGED");
  assert.equal(h.get().token,"edition-1");
  assert.deepEqual(h.applied,[]);
});
test("concurrent edit status is pending without regenerating a token",async()=>{
  const h=setup();const p=h.saveWithStatus();
  h.edit("newer","edition-2");
  h.reply(0,{error:{message:"SETTINGS_REVISION_CONFLICT"}});
  const result=await p;
  assert.equal(result.pending,true);
  assert.equal(result.error,undefined);
  assert.equal(h.get().token,"edition-2");
  assert.equal(h.get().history.at(-1),"Ajustes pendientes de sincronización");
});
