"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("staff access lives inside restaurant while portal keeps customer, restaurant and courier roles",()=>{
 const html=read("index.html"),restaurant=read("restaurante.html");
 assert.equal(html,read("www/index.html"));
 assert.equal(restaurant,read("www/restaurante.html"));
 assert.doesNotMatch(html,/href="(?:\.\/)?mesero\.html"|Personal y estaciones/);
 for(const route of ["cliente.html","restaurante.html","colaborador.html"])assert.ok(html.includes('href="'+route+'"'));
 assert.match(restaurant,/id="waiterTeamButton" type="button">Personal y estaciones<\/button>/);
 assert.match(restaurant,/id="restaurantStaffAccessLink" href="https:\/\/rincon-colombiano-pedidosapp\.vercel\.app\/mesero.html"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
 assert.match(restaurant,/id="restaurantAuthHomeLink" href="\.\/index\.html"/);
 assert.match(read("restaurant-fiscal-ui.js"),/new Set\(\[[^\]]*"restaurantStaffAccessLink"/);
});
