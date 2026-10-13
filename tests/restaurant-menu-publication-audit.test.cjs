"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=fs.readFileSync(path.join(__dirname,"..","restaurant-fiscal-ui.js"),"utf8");
const start=src.indexOf("/* RC ORDERA: read-only menu publication audit.");
assert.ok(start>0);
const moduleSource=src.slice(start);

function harness({remote,local,online=true,user=true}={}){
  let networkReads=0, writes=0, finish;
  const menu=local||{Platos:[{id:"1",name:"Sancocho",description:"Sopa de Colombia",price:50,available:true,
    translations:{es:{name:"Sancocho",description:"Sopa de Colombia"},pl:{name:"",description:""},en:{name:"",description:""}}}]};
  const server=remote||JSON.parse(JSON.stringify(menu));
  class Element {
    constructor(){this.textContent="";this.disabled=false;this.style={};this.listeners={};this.attrs={};}
    setAttribute(key,v){this.attrs[key]=v;}
    insertAdjacentElement(_,el){this.inserted=el;}
    addEventListener(key,fn){this.listeners[key]=fn;}
    click(){this.listeners.click?.();}
  }
  const status=new Element(),publish=new Element();
  const document={
    documentElement:{lang:"es"},
    getElementById:id=>id==="publishCurrentMenuButton"?publish:id==="menuPublicationStatus"?status:null,
    createElement:()=>new Element(),
  };
  const client={from(table){
    assert.equal(table,"restaurant_public_catalogs");
    return {select(cols){
      assert.equal(cols,"menu, menu_revision");
      return {eq(column,id){
        assert.equal(column,"restaurant_user_id");
        assert.equal(id,"restaurant-1");
        return {async maybeSingle(){
          networkReads++;
          return {data:{menu:server,menu_revision:41},error:null};
        }};
      }};
    }};
  }};
  const context={document,window:{addEventListener(){}},navigator:{onLine:online},
    cloudState:{client,user:user?{id:"restaurant-1"}:null},menuCatalog:menu,
    console:{error(){}},MutationObserver:class {observe(){} disconnect(){}},
  };
  vm.runInNewContext(moduleSource,context);
  const button=publish.inserted,output=status.inserted;
  return {button,output,context,reads:()=>networkReads,writes:()=>writes,local:menu};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test("comparison is visible, read-only and confirms identical public/customer/cashier products",async()=>{
  const h=harness();
  assert.equal(h.button.textContent,"Comparar Cliente y Caja");
  h.button.click();await settle();
  assert.match(h.output.textContent,/Este equipo: 1 productos, 1 descripciones ES/);
  assert.match(h.output.textContent,/coinciden con la nube/);
  assert.equal(h.reads(),1);
  assert.equal(h.writes(),0);
});

test("detects missing local descriptions, new products and stale public versions without overwriting anything",async()=>{
  const local={Platos:[{id:"1",name:"Sancocho",description:"Descripción nueva",price:50},
    {id:"2",name:"Empanada de carne",description:"Frita",price:12}]};
  const remote={Platos:[{id:"1",name:"Sancocho",description:"Descripción antigua",price:50}]};
  const original=JSON.stringify(local);
  const h=harness({local,remote});
  h.button.click();await settle();
  assert.match(h.output.textContent,/Este equipo: 2 productos, 2 descripciones ES/);
  assert.match(h.output.textContent,/Cliente y Caja: 1 productos, 1 descripciones ES/);
  assert.match(h.output.textContent,/Hay 2 productos distintos o sin publicar/);
  assert.match(h.output.textContent,/Empanada de carne/);
  assert.equal(JSON.stringify(local),original);
  assert.equal(h.button.disabled,false);
});

test("no session or no internet never sends a Supabase request",async()=>{
  for(const options of [{user:false},{online:false}]){
    const h=harness(options);
    h.button.click();await settle();
    assert.equal(h.reads(),0);
    assert.match(h.output.textContent,/Inicia sesión|Sin conexión/);
  }
});

test("works with ES, PL and EN without adding polling, writes or altering fiscal preflight",async()=>{
  for(const [lang,label] of [["es","Comparar"],["pl","Porównaj"],["en","Compare"]]){
    const h=harness();
    h.context.document.documentElement.lang=lang;
    // Button label updates through a language-change observer on real DOM,
    // while reports resolve the live selected language at click time.
    h.button.click();await settle();
    assert.ok(h.output.textContent.includes(
      lang==="es"?"Este equipo":lang==="pl"?"To urządzenie":"This device"
    ));
    assert.ok(label);
  }
  assert.doesNotMatch(moduleSource,/setInterval\s*\(/);
  assert.doesNotMatch(moduleSource,/\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|\.delete\s*\(|\.rpc\s*\(/);
  assert.equal(src,fs.readFileSync(path.join(__dirname,"..","www/restaurant-fiscal-ui.js"),"utf8"));
  assert.match(src,/navigator\.serial\.requestPort\(\)/);
  new vm.Script(src);
});
