"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const src = fs.readFileSync("app.js","utf8");
const functionStart = src.indexOf("async function loadCloudData()");
const startupStart = src.indexOf("if (menuProductCount(menuCatalog) === 0) {",functionStart);
const startupEnd = src.indexOf("\r\n\r\ntry {\r\n    try {",startupStart);
const settingsStart = src.indexOf("const settingsResponse = startupSettingsResponse || await withCloudTimeout(",startupEnd);
const settingsEnd = src.indexOf("\r\nconst {\r\n  data: settingsRow",settingsStart);
assert.ok(functionStart >= 0 && startupStart > functionStart && startupEnd > startupStart);
assert.ok(settingsStart > startupEnd && settingsEnd > settingsStart);
const startupBlock = src.slice(startupStart,startupEnd);
const settingsBlock = src.slice(settingsStart,settingsEnd);
const selectFields = "menu, settings, menu_revision, settings_revision, menu_updated_at, settings_updated_at";
assert.match(startupBlock,/startupSettingsResponse = \{ data: startupSettingsRow, error: null \}/);
assert.match(startupBlock,/\.select\("menu, settings, menu_revision, settings_revision, menu_updated_at, settings_updated_at"\)/);

async function check({cachedMenu=false,firstFails=false,firstEmpty=false}={}) {
  const calls=[]; let menusRendered=0;
  const remoteMenu={Comidas:[{name:"Arepa"}]};
  const rows=[{data:firstEmpty?{menu:{},menu_revision:3,settings:{currency:"PLN"}}:{menu:remoteMenu,menu_revision:7,settings:{currency:"PLN"}},error:firstFails?{code:"TIMEOUT",message:"temporary"}:null},
              {data:{menu:remoteMenu,menu_revision:8,settings:{currency:"PLN"}},error:null}];
  const client={from(table){
      assert.equal(table,"app_settings");
      const query={};
      query.select=fields=>{assert.equal(fields,selectFields);return query};
      query.eq=()=>query;
      query.maybeSingle=()=>query;
      query.then=(ok,bad)=>{const row=rows[calls.length];calls.push(table);return Promise.resolve(row).then(ok,bad)};
      return query;
  }};
  const context=vm.createContext({
    cloudState:{client,user:{id:"owner"}},
    menuCatalog:cachedMenu?remoteMenu:{},
    EMPTY_MENU_CATALOG:{},
    menuProductCount:menu=>Object.keys(menu||{}).reduce((n,k)=>n+(Array.isArray(menu[k])?menu[k].length:0),0),
    normalizeMenuCatalog:menu=>menu,
    activeCategory:"",
    saveMenuCache:()=>{},
    storeConfirmedCloudMenu:()=>{},
    storeCloudRevision:()=>{},
    STORAGE_KEYS:{menuRevision:"revision"},
    renderCategories:()=>{menusRendered++},
    renderMenu:()=>{menusRendered++},
    withCloudTimeout:async query=>await query,
    console:{error:()=>{}}
  });
  const body = '(async()=>{let startupSettingsResponse=null;'+startupBlock+
     '\nconst settingsRequest=cloudState.client.from("app_settings").select("'+selectFields+'").eq("user_id",cloudState.user.id).maybeSingle();\n'
     +settingsBlock+'\n return {menuCatalog, settingsResponse, menusRendered: '+ '0'+'};})()';
  const outcome=await vm.runInContext(body,context);
  return {calls:calls.length,menu:outcome.menuCatalog,response:outcome.settingsResponse,menusRendered};
}
test("cold-start without cached menu executes only one settings HTTP read",async()=>{
  const r=await check();assert.equal(r.calls,1);assert.equal(r.response.data.menu_revision,7);assert.equal(r.response.data.settings.currency,"PLN");assert.equal(r.menu.Comidas.length,1);
});
test("warm-start uses ordinary single settings read",async()=>{
  const r=await check({cachedMenu:true});assert.equal(r.calls,1);assert.equal(r.response.data.menu_revision,7);
});
test("failed initial menu read falls back to ordinary settings read (no lost menu)",async()=>{
  const r=await check({firstFails:true});assert.equal(r.calls,2);assert.equal(r.response.data.menu_revision,8);
});
test("successful empty menu never refetches identical settings row",async()=>{
  const r=await check({firstEmpty:true});assert.equal(r.calls,1);assert.equal(r.response.data.menu_revision,3);
});
test("published app mirrors source and preserves local-first rendering",()=>{
  assert.equal(src,fs.readFileSync("www/app.js","utf8"));
  assert.match(src.slice(functionStart,startupStart),/renderMenu\(\)/);
});
