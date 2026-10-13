"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root,p), "utf8");
const js = read("app.js");
assert.equal(js, read("www/app.js"), "Android and web source must match");
const from = js.indexOf("function restaurantModuleUrl(filename) {");
const until = js.indexOf("function buildClientOrderLink() {", from);
assert.ok(from > 0 && until > from, "Native URL builder must exist");

function urlFor(filename, {native, href}) {
  const ctx = vm.createContext({ window: {location:{href},Capacitor:{isNativePlatform:()=>native}},URL });
  vm.runInContext(js.slice(from,until), ctx);
  return ctx.restaurantModuleUrl(filename).toString();
}

test("native bundled localhost creates externally openable HTTPS links, not localhost URLs", () => {
  for (const filename of ["cliente.html", "mesero.html"]) {
    assert.equal(urlFor(filename, {native:true,href:"https://localhost/restaurante.html"}),
      "https://rincon-colombiano-pedidosapp.vercel.app/"+filename);
  }
});

test("web, local development and installed PWA retain their own same-origin routes", () => {
  for (const href of ["https://rincon-colombiano-pedidosapp.vercel.app/restaurante.html",
    "http://localhost:5000/restaurante.html",
    "https://example.org/subdir/restaurante.html"]) {
    const origin = new URL(href);
    for (const filename of ["cliente.html","mesero.html"]) {
      assert.equal(urlFor(filename,{native:false,href}),new URL("./"+filename,href).toString());
    }
  }
});

test("public QR and operational station URLs both use the guarded URL builder", () => {
  assert.match(js,/function buildClientOrderLink\(\)\s*\{[\s\S]*?restaurantModuleUrl\("cliente.html"\)/);
  assert.match(js,/function buildWaiterLink\(\)\s*\{[\s\S]*?restaurantModuleUrl\("mesero.html"\)/);
  for (const name of ["restaurante.html", "www/restaurante.html"]) {
    const html=read(name);
    for (const id of ["openClientPageButton", "openWaiterLinkButton", "restaurantKitchenLink"]) {
      assert.match(html,new RegExp('id="'+id+'"[^>]*target="_blank"[^>]*rel="noopener noreferrer"'));
    }
  }
});
