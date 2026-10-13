"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const src=fs.readFileSync(path.join(root,"app.js"),"utf8");
const mirror=fs.readFileSync(path.join(root,"www/app.js"),"utf8");
assert.equal(src,mirror,"Android/web app.js must be identical");
const start=src.indexOf("let qrMenuSyncInFlight = null;");
const stop=src.indexOf("async function copyQrLink()",start);
assert.ok(start>0&&stop>start);
const js=src.slice(start,stop);

function harness({pending=null,confirmed=true,changed=false,settingsPending=null, delayed=false}={}){
  const menu={Platos:[{id:"one",name:"Tamal",description:"Tamales caseros",price:48}]};
  let currentMenu=structuredClone(menu), token=pending, rpcCalls=0, settingsCalls=0, opened=0, release=null, alerts=0;
  const cloud={client:{},configured:true,user:{id:"restaurant-1"}};
  const dialog={open:false,showModal(){this.open=true;opened++}};
  const ctx=vm.createContext({
    cloudState:cloud,
    menuCatalog:currentMenu,
    STORAGE_KEYS:{menuRevision:"revision"},
    navigator:{onLine:true},
    elements:{qrDialog:dialog},
    currentSettingsPendingToken:()=>settingsPending,
    currentMenuPendingToken:()=>token,
    clearSettingsPending:()=>true,
    clearMenuPending:(expected)=>{if(token!==expected)return false;token=null;return true},
    saveCloudSettings:async()=>{settingsCalls++},
    saveCloudMenu:()=>{rpcCalls++;return delayed?new Promise(res=>release=res):Promise.resolve({localChangesPending:false})},
    storedCloudRevision:()=>41,
    readConfirmedCloudMenu:()=>confirmed?structuredClone(menu):null,
    menuCatalogsMatch:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
    markMenuPending:()=>{token="new-draft"},
    updateCloudStatus:()=>{},
    updateQrPreview:()=>{},
    openSignInScreen:()=>{},
    alert:()=>{alerts++},
    console:{error:()=>{}}
  });
  vm.runInContext(js,ctx);
  return {ctx,cloud,dialog,get stats(){return{rpcCalls,settingsCalls,opened,alerts,token}},
   finish:(result={localChangesPending:false})=>release?.(result),
   changeMenu:()=>{}};
}

test("Opening QR for unchanged confirmed menu performs zero RPC writes",async()=>{
 const h=harness();
 assert.equal(await h.ctx.syncMenuBeforeQr(),true);
 assert.equal(h.stats.rpcCalls,0);
 assert.equal(h.stats.alerts,0);
 assert.equal(h.stats.token,null);
});

test("Opening QR still publishes unconfirmed local changes and preserves pending tokens",async()=>{
 const pending=harness({pending:"edit-v1"});
 assert.equal(await pending.ctx.syncMenuBeforeQr(),true);
 assert.equal(pending.stats.rpcCalls,1);
 assert.equal(pending.stats.token,null);
 const unconfirmed=harness({confirmed:false});
 assert.equal(await unconfirmed.ctx.syncMenuBeforeQr(),true);
 assert.equal(unconfirmed.stats.rpcCalls,1);
 const unsaved=harness({pending:"edit-v1",delayed:true});
 const p=unsaved.ctx.syncMenuBeforeQr();
 unsaved.ctx.currentMenuPendingToken=()=>"edit-v2";
 unsaved.ctx.clearMenuPending=()=>false;
 unsaved.finish();
 assert.equal(await p,false);
 assert.equal(unsaved.stats.rpcCalls,1);
});

test("Concurrent QR openings have one in-flight save and open one dialog",async()=>{
 const h=harness({pending:"change",delayed:true});
 const first=h.ctx.openQrDialog();
 const second=h.ctx.openQrDialog();
 await Promise.resolve();
 assert.equal(h.stats.rpcCalls,1);
 h.finish();
 await Promise.all([first,second]);
 assert.equal(h.stats.rpcCalls,1);
 assert.equal(h.stats.opened,1);
});

test("No QR modal opens after logout during asynchronous publication",async()=>{
 const h=harness({pending:"change",delayed:true});
 const opening=h.ctx.openQrDialog();
 h.cloud.user={id:"restaurant-2"};
 h.finish();
 await opening;
 assert.equal(h.stats.opened,0);
});

test("Opening QR for confirmed menu with pending settings only saves settings",async()=>{
 const h=harness({settingsPending:"settings-2"});
 assert.equal(await h.ctx.syncMenuBeforeQr(),true);
 assert.equal(h.stats.settingsCalls,1);
 assert.equal(h.stats.rpcCalls,0);
});
