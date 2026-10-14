"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const original=fs.readFileSync(path.join(root,"restaurant-fiscal-ui.js"),"utf8");
assert.equal(original,fs.readFileSync(path.join(root,"www/restaurant-fiscal-ui.js"),"utf8"));
const marker="/* RC ORDERA: non-destructive LOCAL menu backup";
const position=original.indexOf(marker);
assert.ok(position>0,"Local backup module must be available");
const source=original.slice(position);

function harness({locale="es",pending=true,menu=null,toolbar=true}={}){
  let currentLocale=locale,pendingState=pending;
  const creations=[],revoked=[],calls=[],widgets=new Map();
  class Node {
    constructor(tag="div"){this.tag=tag;this.style={};this.attrs={};this.hidden=false;this.listeners={};this.textContent="";this.children=[];this.disabled=false;}
    setAttribute(name,value){this.attrs[name]=value;}
    addEventListener(name,handler){this.listeners[name]=handler;}
    insertAdjacentElement(_pos,item){this.inserted=(this.inserted||[]).concat([item]);}
    append(...nodes){this.children.push(...nodes);}
    appendChild(el){this.children.push(el);}
    remove(){}
    click(){ this.listeners.click?.(); }
  }
  for(const id of ["restaurantMenuSection","publishCurrentMenuButton","cloudStatus"])widgets.set(id,new Node());
  const service=toolbar?new Node():null;
  const document={
    documentElement:{get lang(){return currentLocale;}},
    body:new Node(),
    getElementById(id){
      if(widgets.has(id))return widgets.get(id);
      for(const n of creations)if(n.id===id)return n;
      return null;
    },
    querySelector(selector){return selector===".restaurant-service-bar"?service:null;},
    createElement(tag){const item=new Node(tag);creations.push(item);return item;},
    addEventListener(){},removeEventListener(){}
  };
  const menuCatalog=menu===null?{Platos:[{id:"a",name:"Tamal",description:"Tamales de Colombia",translations:{pl:{description:"Kolumbijskie tamale"}},price:48}]}:menu;
  const blobs=[];
  const context=vm.createContext({
    document,window:{addEventListener(){},setTimeout:()=>null},navigator:{onLine:false},
    cloudState:{user:{id:"test-restaurant"},client:{from(){throw new Error("A backup must never use Supabase");}}},
    menuCatalog,hasPendingMenu:()=>pendingState,
    URL:{createObjectURL(blob){blobs.push(blob);return "blob:menu";},revokeObjectURL(url){revoked.push(url)}},
    Blob, Date, JSON, Object, console:{error:()=>{}},
    MutationObserver:class {observe(){} disconnect(){}},
    openMenuEditor:()=>calls.push("open"),showRestaurantEditSection:section=>calls.push(section),
  });
  vm.runInContext(source,context);
  const backup=creations.find(n=>n.id==="backupLocalRestaurantMenuButton");
  const status=creations.find(n=>n.id==="localMenuBackupResult");
  const warning=creations.find(n=>n.id==="unpublishedMenuWarning");
  const enter=creations.find(n=>n.id==="unpublishedMenuOpenButton");
  return {context,backup,status,warning,enter,blobs,calls,creations,service,
    get pending(){return pendingState;},
    setPending(v){pendingState=v;vm.runInContext("void 0",context);},
    setLocale(v){currentLocale=v;},
    getNetworkCalls:()=>calls.filter(x=>x==="rpc").length
  };
}
test("Local backup produces an exact translated menu snapshot and never changes the local object",async()=>{
  const h=harness();
  const baseline=JSON.stringify(h.context.menuCatalog);
  h.backup.click();
  assert.equal(h.blobs.length,1);
  const saved=JSON.parse(await h.blobs[0].text());
  assert.equal(saved.format,"RC_ORDERA_LOCAL_MENU_BACKUP_V1");
  assert.equal(saved.publicationVerified,false);
  assert.equal(saved.menu.Platos[0].translations.pl.description,"Kolumbijskie tamale");
  assert.equal(JSON.stringify(h.context.menuCatalog),baseline);
  assert.equal(h.pending,true);
  assert.match(h.status.textContent,/local descargado/);
  assert.equal(h.warning.hidden,false);
  assert.equal(h.getNetworkCalls(),0);
});
test("Empty menu blocks download without deleting any data",()=>{
  const h=harness({menu:{Platos:[]}});
  h.backup.click();
  assert.equal(h.blobs.length,0);
  assert.match(h.status.textContent,/No hay productos/);
});
test("Unpublished menu is visibly indicated; publishing action uses existing menu editor only",()=>{
  const h=harness({pending:true});
  assert.equal(h.warning.hidden,false);
  h.enter.click();
  assert.deepEqual(h.calls,["open","restaurant-menu"]);
  assert.equal(h.getNetworkCalls(),0);
});
test("No pending menu does not falsely claim unpublished changes; UI supports ES PL EN",()=>{
  for(const [lang,expected] of [["es","Descargar respaldo"],["pl","Pobierz kopię"],["en","Download this"]]){
    const h=harness({locale:lang,pending:false});
    assert.equal(h.warning.hidden,true);
    assert.match(h.backup.textContent,new RegExp(expected));
    assert.equal(h.getNetworkCalls(),0);
  }
});
test("No polling, Supabase writes, cache clearing or menu mutation in backup module",()=>{
  assert.doesNotMatch(source,/setInterval\s*\(/);
  assert.doesNotMatch(source,/\.rpc\s*\(|\.upsert\s*\(|\.delete\s*\(|localStorage\.clear\s*\(/);
  assert.doesNotMatch(source,/menuCatalog\s*=/);
  new vm.Script(source);
});
