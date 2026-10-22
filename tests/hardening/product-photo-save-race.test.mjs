import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const source=readFileSync("app.js","utf8");
const begin=source.indexOf("async function saveProduct() {");
const end=source.indexOf("function editProduct(",begin);
assert.ok(begin>0 && end>begin,"real product save handler found");
const actualSource=source.slice(begin,end);
const normalizeSource=source.match(/function normalizeProductDescription\(value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(normalizeSource,"real lossless description helper found");

function harness({isUpload=true}={}){
  let finishUpload, failUpload, cloudSaves=0, cleared=0, toasted=[];
  const upload=new Promise((resolve,reject)=>{finishUpload=resolve;failUpload=reject;});
  const field=(value)=>({value});
  const elements={
    saveProductButton:{disabled:false},
    productCategorySelect:field("Entradas"),
    productNameInput:field("Arepa"),
    productDescriptionInput:field("Sabrosa arepa."),
    productNamePlInput:field("Arepa"),
    productDescriptionPlInput:field("Pyszna arepa."),
    productNameEnInput:field("Arepa"),
    productDescriptionEnInput:field("Tasty arepa."),
    productPriceInput:field("15"),
    productImageUrlInput:field(isUpload?"data:image/png;base64,AA==":"https://example.test/image.jpg"),
    productAvailableInput:{checked:true},
    productStationSelect:field("kitchen"),
    productVatSelect:field(""),
  };
  const context={
    elements,
    menuCatalog:{Entradas:[]},
    activeCategory:"Entradas",
    editingProduct:null,
    cloudState:{client:{},user:{id:"restaurant-a"}},
    navigator:{onLine:true},
    window:{RC_ORDERA_OFFLINE_I18N:null},
    normalizeProductImageUrl:value=>value,
    normalizeProductTranslations:(_old,name,description)=>({
      es:{name,description},pl:{name:"",description:""},en:{name:"",description:""}
    }),
    normalizeProductStation:value=>value,
    normalizeVatRate:()=>null,
    normalizeProductId:value=>value||"",
    createProductId:()=>"product-a",
    normalizeMenuCatalog:x=>JSON.parse(JSON.stringify(x)),
    isInlineRestaurantImage:value=>value.startsWith("data:"),
    uploadRestaurantImageDataUrl:()=>upload,
    updateCloudStatus:()=>{},
    showToast:text=>toasted.push(text),
    appUiText:text=>text,
    renderCategories:()=>{},
    renderMenu:()=>{},
    renderMenuEditor:()=>{},
    clearProductForm:()=>cleared++,
    syncResultMessage:text=>text,
    saveMenuCatalog:async()=>{cloudSaves++;return {synced:true};},
    alert:message=>toasted.push(message),
    console
  };
  vm.createContext(context);
  const save=vm.runInContext(normalizeSource+"\n"+actualSource+"\nsaveProduct",context);
  return {context,elements,save,finishUpload,failUpload,
    calls:()=>({cloudSaves,cleared,toasted})};
}
test("root and Android runtime carry the exact same product editor guards",()=>{
  assert.equal(source,readFileSync("www/app.js","utf8"));
});
test("late upload cannot overwrite descriptions typed while photo was uploading",async()=>{
  const h=harness();
  const save=h.save();
  h.elements.productDescriptionPlInput.value="Zupełnie nowy opis w trakcie uploadu";
  h.finishUpload("https://cdn.test/photo.jpg");
  await save;
  assert.equal(h.context.menuCatalog.Entradas.length,0);
  assert.equal(h.calls().cloudSaves,0);
  assert.equal(h.elements.productDescriptionPlInput.value,"Zupełnie nowy opis w trakcie uploadu");
  assert.equal(h.calls().cleared,0);
});
test("late upload cannot insert previous owner's product into another restaurant",async()=>{
  const h=harness();
  const save=h.save();
  h.context.cloudState.user={id:"restaurant-b"};
  h.context.menuCatalog={Entradas:[]};
  h.finishUpload("https://cdn.test/photo.jpg");
  await save;
  assert.equal(h.context.menuCatalog.Entradas.length,0);
  assert.equal(h.calls().cloudSaves,0);
});
test("failed upload does not roll back unrelated catalog edits",async()=>{
  const h=harness();
  const save=h.save();
  h.context.menuCatalog.Entradas.push({id:"another-edit",name:"New item"});
  h.failUpload(new Error("Network upload interrupted"));
  await save;
  assert.equal(h.context.menuCatalog.Entradas[0].id,"another-edit");
  assert.equal(h.calls().cloudSaves,0);
});
test("valid photo upload preserves long ES/PL/EN descriptions and publishes product",async()=>{
  const h=harness();
  const es="Delicioso 🥘 y sin límite. ".repeat(600);
  const pl="Pyszna potrawa, żółty ser 🧀. ".repeat(600);
  const en="Fresh ingredients with sauce 🥗. ".repeat(600);
  h.elements.productDescriptionInput.value=es;
  h.elements.productDescriptionPlInput.value=pl;
  h.elements.productDescriptionEnInput.value=en;
  const save=h.save();
  h.finishUpload("https://cdn.test/photo.jpg");
  await save;
  const product=h.context.menuCatalog.Entradas[0];
  assert.equal(product.description,es.trim());
  assert.equal(product.translations.es.description,es.trim());
  assert.equal(product.translations.pl.description,pl.trim());
  assert.equal(product.translations.en.description,en.trim());
  assert.equal(product.imageUrl,"https://cdn.test/photo.jpg");
  assert.deepEqual(h.calls().cloudSaves,1);
  assert.deepEqual(h.calls().cleared,1);
});
