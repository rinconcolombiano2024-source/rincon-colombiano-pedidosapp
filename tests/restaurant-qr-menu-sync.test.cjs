"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const source = read("app.js");
assert.equal(source, read("www/app.js"), "web and Android assets stay identical");
const from = source.indexOf("async function syncMenuBeforeQr()");
const until = source.indexOf("async function copyQrLink()", from);
assert.ok(from >= 0 && until > from);
const chunk = source.slice(from, until);

function harness({revision=1, menuPending=false, settingsPending=false, saveMenu}={}) {
  let menuSaves=0,settingsSaves=0,opened=0,previews=0,alerts=0;
  const btn = {disabled:false,attributes:new Map(),
    setAttribute(k,v) {this.attributes.set(k,v);} };
  const dialog = {open:false,showModal() {opened++;this.open=true;}};
  const ctx = vm.createContext({
    cloudState:{configured:true,user:{id:"restaurant-A"}},
    navigator:{onLine:true},
    elements:{qrButton:btn,qrDialog:dialog},
    STORAGE_KEYS:{menuRevision:"menu_revision"},
    storedCloudRevision:()=>revision,
    currentMenuPendingToken:()=>menuPending?"menu-token":null,
    currentSettingsPendingToken:()=>settingsPending?"settings-token":null,
    saveCloudMenu:async()=>{menuSaves++; if(saveMenu) await saveMenu();},
    saveCloudSettings:async()=>{settingsSaves++;},
    clearMenuPending:()=>{menuPending=false;},
    clearSettingsPending:()=>{settingsPending=false;},
    updateCloudStatus:()=>{},
    updateQrPreview:()=>{previews++;},
    openSignInScreen:()=>{},
    markMenuPending:()=>{menuPending=true;},
    alert:()=>{alerts++;},
    console:{error:()=>{}}
  });
  vm.runInContext(chunk,ctx,{filename:"app.js:QR-preflight"});
  return {ctx,btn,dialog,stats:()=>({menuSaves,settingsSaves,opened,previews,alerts})};
}

test("100 QR previews of a published clean menu issue zero cloud-menu writes", async()=>{
  const h=harness({revision:5});
  for(let i=0;i<100;i++) assert.equal(await h.ctx.syncMenuBeforeQr(),true);
  assert.equal(h.stats().menuSaves,0);
  assert.equal(h.stats().settingsSaves,0);
});

test("dirty or never-published menu is saved exactly once, then skipped on repeated QR opens", async()=>{
  for(const state of [{revision:5,menuPending:true},{revision:0,menuPending:false}]) {
    const h=harness(state);
    assert.equal(await h.ctx.syncMenuBeforeQr(),true);
    assert.equal(h.stats().menuSaves,1);
    assert.equal(await h.ctx.syncMenuBeforeQr(),true);
    // First-publication tests hold revision=0 deliberately: without an actual
    // committed server revision a retry remains required, never silently skipped.
    assert.equal(h.stats().menuSaves,state.revision===0?2:1);
  }
});

test("dirty restaurant settings sync separately; menu is not rewritten if unchanged", async()=>{
  const h=harness({revision:2,settingsPending:true});
  assert.equal(await h.ctx.syncMenuBeforeQr(),true);
  assert.deepEqual({settings:h.stats().settingsSaves,menu:h.stats().menuSaves},{settings:1,menu:0});
});

test("100 rapid QR taps trigger one save and one dialog, then restore usable button", async()=>{
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  const h=harness({revision:5,menuPending:true,saveMenu:()=>pending});
  const first=h.ctx.openQrDialog();
  await Promise.all(Array.from({length:99},()=>h.ctx.openQrDialog()));
  assert.equal(h.stats().menuSaves,1);
  assert.equal(h.btn.disabled,true);
  assert.equal(h.btn.attributes.get("aria-busy"),"true");
  release();
  await first;
  assert.equal(h.stats().opened,1);
  assert.equal(h.stats().previews,1);
  assert.equal(h.btn.disabled,false);
  assert.equal(h.btn.attributes.get("aria-busy"),"false");
});

test("offline QR does not save or display stale menu", async()=>{
  const h=harness({revision:10,menuPending:true});
  h.ctx.navigator.onLine=false;
  assert.equal(await h.ctx.syncMenuBeforeQr(),false);
  assert.equal(h.stats().menuSaves,0);
  assert.equal(h.stats().alerts,1);
});
