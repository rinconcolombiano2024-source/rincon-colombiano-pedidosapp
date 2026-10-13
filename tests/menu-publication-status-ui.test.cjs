"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");

test("restaurant editor has explicit and visible publish/verify button; web and Android assets agree",()=>{
  for(const name of ["restaurante.html","app.js","styles.css","offline-i18n.js"]){
    assert.equal(read(name),read("www/"+name),name+" distribution mismatch");
  }
  const html=read("restaurante.html"),js=read("app.js");
  assert.match(html,/id="publishCurrentMenuButton" type="button"/);
  assert.match(html,/id="menuPublicationStatus" role="status" aria-live="polite"/);
  assert.match(html,/app\.js\?v=91\.0\.4-menuverify1/);
  assert.match(html,/styles\.css\?v=91\.0\.4-menuverify1/);
  assert.match(js,/publishCurrentMenuButton: document\.querySelector\("#publishCurrentMenuButton"\)/);
  assert.match(js,/publishCurrentMenuButton\?\.addEventListener\("click", publishCurrentRestaurantMenu\)/);
  assert.match(js,/async function publishCurrentRestaurantMenu\(\) \{[\s\S]*?markMenuPending\(\);[\s\S]*?saveMenuWhenPossible\(/);
});

test("all new publication status captions have Spanish, Polish and English versions",()=>{
  const win={};
  vm.runInNewContext(read("offline-i18n.js"),{window:win});
  const api=win.RC_ORDERA_OFFLINE_I18N;
  const captions=[
    "Publicación del menú",
    "Menú público de Cliente y Caja",
    "Los productos editados en este equipo solo aparecerán en Cliente y Caja después de confirmar la publicación.",
    "Publicar y verificar menú",
    "Guardado en este dispositivo; no se pudo confirmar la publicación para Cliente y Caja. No borres los datos: vuelve a sincronizar.",
    "Cambió la cuenta durante la verificación del menú. Vuelve a sincronizar.",
  ];
  for(const es of captions){
    assert.ok(api.keyForSource(es),"Missing translation key: "+es);
    for(const lang of ["pl","en"]){
      const translated=api.translate(es,lang);
      assert.ok(translated&&translated!==es,lang+" missing: "+es);
    }
  }
});
