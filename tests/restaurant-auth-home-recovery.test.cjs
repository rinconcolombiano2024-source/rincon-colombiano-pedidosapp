"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const load=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("restaurant auth offers a home exit from landing and modal in both bundles",()=>{
 assert.equal(load("restaurante.html"),load("www/restaurante.html"));
 assert.equal(load("app.js"),load("www/app.js"));
 const html=load("restaurante.html");
 for(const id of ["restaurantAuthHomeLink","restaurantAuthDialogHomeLink"]){
  const tag=html.match(new RegExp('<a[^>]+id="'+id+'"[^>]*>'));
  assert.ok(tag, "missing "+id);
  assert.match(tag[0],/href="\.\/index\.html"/);
  assert.match(tag[0],/data-rc-auth-home/);
 }
 assert.match(html,/app\.js\?v=91\.0\.4-nav3/);
});
test("localized home link works for ES PL EN and does not modify session",()=>{
 const src=load("app.js");
 const start=src.indexOf("function updateRestaurantAuthHomeLinks()");
 const end=src.indexOf("function openSignInScreen()",start);
 assert.ok(start>=0&&end>start);
 let locale="es";
 const links=[{textContent:""},{textContent:""}];
 const ctx=vm.createContext({document:{
  querySelector:()=>({get value(){return locale}}),
  querySelectorAll:()=>links
 }});
 vm.runInContext(src.slice(start,end),ctx);
 for(const [language,expected] of [["es","Inicio"],["pl","Strona główna"],["en","Home"]]){
  locale=language;
  vm.runInContext("updateRestaurantAuthHomeLinks()",ctx);
  assert.ok(links.every(x=>x.textContent.includes(expected)));
 }
});
