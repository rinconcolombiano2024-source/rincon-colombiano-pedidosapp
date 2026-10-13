"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("portal gives cashier and kitchen a discoverable stations entry without replacing existing roles",()=>{
 const html=read("index.html");
 assert.equal(html,read("www/index.html"));
 assert.match(html,/<a class="app-card" href="mesero\.html" aria-label="Abrir estaciones del restaurante">/);
 assert.match(html,/Entrar a estaciones/);
 assert.match(html,/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
 for(const route of ["cliente.html","restaurante.html","colaborador.html"])assert.ok(html.includes('href="'+route+'"'));
 assert.match(read("restaurante.html"),/id="restaurantAuthHomeLink" href="\.\/index\.html"/);
});
