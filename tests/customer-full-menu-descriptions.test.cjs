"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const {readFileSync}=require("node:fs");
const original=readFileSync("cliente.js","utf8");
assert.equal(original,readFileSync("www/cliente.js","utf8"),"Browser and Android menu renderers must match");
const start=original.indexOf("function customerNormalizeProductDescription(value) {");
const end=original.indexOf("function customerFormatMoney(",start);
const first=original.indexOf("function customerHasSavedDishTranslation(");
const last=original.indexOf("function customerScheduleDescriptionRender(",first);
assert.ok(start>=0 && end>start && first>=0 && last>first);
let fallbacks=0;
const ctx=vm.createContext({
  customerLanguage:"es", customerCleanCategoryName:String,
  customerCategoryKey:x=>String(x).trim().toLowerCase(),
  customerMenuTextDisplay:value=>{fallbacks++;return "fallback:"+value;},
});
vm.runInContext(original.slice(start,end)+"\n"+original.slice(first,last),ctx);
const long="Sancocho de bagre ñ Ż 🌽 con ingredientes tradicionales y preparación. ".repeat(45)+"FIN ÚNICO";
const clean=long.replace(/\s+/g," ").trim();
const es="Descripción española 🌽 ".repeat(90)+"ÚLTIMA PALABRA";
const pl="Opis polski Ż 🌽 ".repeat(90)+"OSTATNIE SŁOWO";
const en="English product details 🌽 ".repeat(90)+"LAST WORD";
test("all published menu descriptions remain complete and prices unchanged",()=>{
  const menu=ctx.customerNormalizeMenu({Platos:[{id:"dish-1",name:"Sancocho",price:55,description:long,translations:{es:{name:"Sancocho",description:es},pl:{name:"Sancocho",description:pl},en:{name:"Sancocho",description:en}}}]});
  const product=menu.Platos[0];
  assert.equal(product.description,clean);
  assert.equal(product.description.endsWith("FIN ÚNICO"),true);
  assert.equal(product.price,55);
  assert.equal(product.id,"dish-1");
  for(const [lang,wanted] of [["es",es],["pl",pl],["en",en]]){
    ctx.customerLanguage=lang;
    assert.equal(ctx.customerLocalizedDishField(product,"description"),wanted.trim());
  }
  assert.equal(fallbacks,0,"Saved merchant translations cannot be overridden by auto translation");
});
test("long unsaved translations display the full source instead of the first 260 characters",()=>{
  ctx.customerLanguage="pl";
  const menu=ctx.customerNormalizeMenu({Platos:[{id:"dish-2",name:"Dorada",price:55,description:long}]});
  const text=ctx.customerLocalizedDishField(menu.Platos[0],"description");
  assert.equal(text,clean);
  assert.equal(text.endsWith("FIN ÚNICO"),true);
  assert.equal(fallbacks,0,"Do not submit unbounded product text to translation fallback");
});
test("legacy product fallback IDs and short auto translation requests remain stable",()=>{
  const shorter=ctx.customerNormalizeProductDescription(long);
  assert.equal(shorter.length,260,"Auto-translation payload stays bounded");
  const oldId=ctx.customerStableProductId("Platos","Dorada",shorter);
  const menu=ctx.customerNormalizeMenu({Platos:[{name:"Dorada",price:55,description:long}]});
  assert.equal(menu.Platos[0].id,oldId);
  ctx.customerLanguage="pl";
  assert.equal(ctx.customerLocalizedDishField({description:"Caldo tradicional"},"description"),"fallback:Caldo tradicional");
  assert.equal(fallbacks,1,"Existing short-text translation path unchanged");
});
test("full description normalizer preserves Unicode and never trims valid trailing content",()=>{
  const desc="Colombiano Ż 🌽 ".repeat(1000)+"Ingredientes finales";
  assert.equal(ctx.customerNormalizePublishedDescription(desc).endsWith("Ingredientes finales"),true);
  assert.equal(ctx.customerNormalizePublishedDescription(desc).length,desc.trim().length);
});