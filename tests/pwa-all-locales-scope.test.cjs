"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(base,file),"utf8");

const targets = {
  restaurante: "restaurante.html",
  cliente: "cliente.html",
  mesero: "mesero.html"
};
for(const locale of ["es","pl","en"]){
  for(const [role,pathname] of Object.entries(targets)){
    const suffix=locale==="es"?"":"."+locale;
    const filename=role+"-manifest"+suffix+".webmanifest";
    test("PWA "+role+" "+locale+": owns its own route, not another module",()=>{
      const manifest=JSON.parse(read(filename));
      const deployed=JSON.parse(read("www/"+filename));
      assert.deepEqual(deployed,manifest,"www distribution must be identical");
      assert.ok(manifest.id && manifest.start_url);
      assert.equal(manifest.display,"standalone");
      const origin="https://example.test/";
      const scope=new URL(manifest.scope,origin);
      const start=new URL(manifest.start_url,origin);
      assert.equal(scope.href,origin+pathname);
      assert.ok(start.href.startsWith(scope.href),"own start_url within narrow scope");
      assert.equal(start.searchParams.get("lang") || "es",locale);
      for(const [otherRole,otherPath] of Object.entries(targets)){
        if(otherRole===role)continue;
        const other=new URL("./"+otherPath+"?app=v91.0.4",origin);
        assert.ok(!other.href.startsWith(scope.href),role+" must not capture "+otherRole);
      }
    });
  }
}
test("restaurant QR/station/kitchen retain explicit new browsing context",()=>{
  for(const prefix of ["","www/"]){
    const html=read(prefix+"restaurante.html");
    for(const id of ["openClientPageButton","openWaiterLinkButton","restaurantKitchenLink"]){
      assert.match(html,new RegExp('id="'+id+'"[^>]*target="_blank"[^>]*rel="noopener noreferrer"'));
    }
    assert.match(html,/id="openFiscalPrinterTopButton"/);
    assert.match(html,/id="connectFiscalPrinterButton"/);
  }
});
