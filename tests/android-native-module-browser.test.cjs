"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const base = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(base,name), "utf8");

function runtime({ native=true, browser=true, language="es" }={}) {
  const scripts=read("restaurant-fiscal-ui.js");
  const from=scripts.lastIndexOf("/*\n * Capacitor native module links.");
  assert.ok(from>0,"Android native bridge bundled after fiscal code");
  const listeners = {};
  const calls = [];
  const toast={textContent:"",hidden:true};
  const location={href:"https://localhost/restaurante.html"};
  let finish = () => {};
  const isOpen = browser ? { open({url}) { calls.push(url); return new Promise(r=>{ finish=r; }); } } : {};
  const cap={isNativePlatform:()=>native,Plugins:{Browser:isOpen}};
  const document={
    documentElement:{lang:language},
    addEventListener:(name,callback)=>{listeners[name]=callback;},
    getElementById:id=>id==="toastNotice"?toast:null,
  };
  vm.runInNewContext(scripts.slice(from),{window:{Capacitor:cap,location},document,URL,Promise});
  const click=(id,href,priorPrevented=false)=>{
    const anchor={id,getAttribute:()=>href};
    const event={defaultPrevented:priorPrevented,
      target:{closest:()=>anchor},
      preventDefault(){this.defaultPrevented=true;}};
    listeners.click(event);
    return event;
  };
  return {click,calls,toast,location,finish:()=>finish(),cap};
}

test("Android opens customer + station through native Browser and keeps restaurant URL intact",async()=>{
  const h=runtime();
  const c=h.click("openClientPageButton","https://rincon-colombiano-pedidosapp.vercel.app/cliente.html?restaurant=a");
  assert.equal(c.defaultPrevented,true);
  await Promise.resolve(); 
  assert.equal(h.calls.length,1);
  assert.match(h.calls[0],/\/cliente\.html\?restaurant=a$/);
  const second=h.click("openWaiterLinkButton","https://rincon-colombiano-pedidosapp.vercel.app/mesero.html");
  assert.equal(second.defaultPrevented,true);
  assert.equal(h.calls.length,1,"second launch must not stack while pending");
  h.finish(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  const station=h.click("restaurantKitchenLink","https://rincon-colombiano-pedidosapp.vercel.app/mesero.html?station=kitchen");
  assert.equal(station.defaultPrevented,true);
  await Promise.resolve();
  assert.equal(h.calls.length,2);
  assert.match(h.calls[1],/station=kitchen/);
  assert.equal(h.location.href,"https://localhost/restaurante.html");
  h.finish();
});

test("Regular browser retains native target=_blank with no intercepted navigation",()=>{
  const h=runtime({native:false});
  const event=h.click("openClientPageButton","./cliente.html");
  assert.equal(event.defaultPrevented,false);
  assert.equal(h.calls.length,0);
});

test("Android rejects untrusted host and local URLs and never opens a checkout accidentally",()=>{
  const h=runtime();
  for(const url of ["https://evil.example/cliente.html","https://localhost/cliente.html",
    "http://rincon-colombiano-pedidosapp.vercel.app/mesero.html",
    "https://rincon-colombiano-pedidosapp.vercel.app/admin.html"]) {
      assert.equal(h.click("openWaiterLinkButton",url).defaultPrevented,true);
  }
  assert.equal(h.calls.length,0);
  assert.equal(h.toast.hidden,false);
  assert.match(h.toast.textContent,/enlace/);
  assert.equal(h.click("openClientPageButton",null,true).defaultPrevented,true);
});

test("Uninstalled native plugin cannot cause Android app to navigate or close; ES PL EN fallback",()=>{
  for(const [lang,text] of [["es","Actualiza"],["pl","Zaktualizuj"],["en","Update"]]) {
    const h=runtime({native:true,browser:false,language:lang});
    const ev=h.click("openClientPageButton","https://rincon-colombiano-pedidosapp.vercel.app/cliente.html");
    assert.equal(ev.defaultPrevented,true);
    assert.equal(h.calls.length,0);
    assert.ok(h.toast.textContent.includes(text));
    assert.equal(h.location.href,"https://localhost/restaurante.html");
  }
});

test("distribution, Capacitor native plugin and no polling remain consistent",()=>{
  assert.equal(read("restaurant-fiscal-ui.js"),read("www/restaurant-fiscal-ui.js"));
  const pkg=JSON.parse(read("package.json"));
  const lock=JSON.parse(read("package-lock.json"));
  assert.equal(pkg.dependencies["@capacitor/browser"],"8.0.5");
  assert.equal(lock.packages[""].dependencies["@capacitor/browser"],"8.0.5");
  assert.equal(lock.packages["node_modules/@capacitor/browser"].version,"8.0.5");
  assert.doesNotMatch(read("restaurant-fiscal-ui.js"),/setInterval\s*\(/);
});
