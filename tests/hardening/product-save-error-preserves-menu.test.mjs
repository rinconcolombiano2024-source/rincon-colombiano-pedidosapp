import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync("app.js", "utf8");
assert.equal(source, readFileSync("www/app.js","utf8"), "Android and web must use identical product-saving code");
const begin = source.indexOf("async function saveProduct() {");
const end = source.indexOf("function editProduct(", begin);
assert.ok(begin > 0 && end > begin);
const normalize = source.match(/function normalizeProductDescription\\(value\\) \\{[\\s\\S]*?\\n\\}/)?.[0];
assert.ok(normalize);
function harness() {
  let finish, reject, marked = 0, cached = 0, cleared = 0;
  const saved = [];
  const response = new Promise((resolve, rejectPromise) => { finish = resolve; reject = rejectPromise; });
  const field = value => ({ value });
  const elements = {
    saveProductButton: { disabled: false }, productCategorySelect: field("Entradas"),
    productNameInput: field("Tamal"), productDescriptionInput: field("Descripción larga 🥘 ".repeat(900)),
    productNamePlInput: field("Tamal"), productDescriptionPlInput: field("Opis potrawy 🥘 ".repeat(900)),
    productNameEnInput: field("Tamal"), productDescriptionEnInput: field("Description 🥘 ".repeat(900)),
    productPriceInput: field("48"), productImageUrlInput: field("https://cdn.example.test/tamal.jpg"),
    productAvailableInput: { checked: true }, productStationSelect: field("kitchen"),
    productVatSelect: field("")
  };
  const ctx = {
    elements, menuCatalog: { Entradas: [] }, activeCategory: "Entradas",
    editingProduct: null, cloudState: { client: {}, user: { id: "restaurant-one" } },
    navigator: { onLine: true }, window: { RC_ORDERA_OFFLINE_I18N: null },
    normalizeProductImageUrl: x => x, normalizeProductTranslations: (_product,name,description) =>
      ({ es: {name,description}, pl: {}, en: {} }),
    normalizeProductStation: x => x, normalizeVatRate: () => null,
    normalizeProductId: x => x || "", createProductId: () => "p-tamal",
    normalizeMenuCatalog: x => JSON.parse(JSON.stringify(x)),
    isInlineRestaurantImage: () => false,
    uploadRestaurantImageDataUrl: () => {throw Error("unexpected upload");},
    markMenuPending: () => {marked++;}, saveMenuCache: options => {
      assert.equal(options.immediate, true);
      cached++;
      saved.push(JSON.parse(JSON.stringify(ctx.menuCatalog)));
    },
    updateCloudStatus: () => {}, showToast: () => {}, appUiText: x => x,
    renderCategories: () => {}, renderMenu: () => {}, renderMenuEditor: () => {},
    clearProductForm: () => {cleared++;},
    syncResultMessage: x => x, saveMenuCatalog: () => response,
    alert: x => {ctx.alerted = x;}, console
  };
  vm.createContext(ctx);
  const save = vm.runInContext(normalize + "\n" + source.slice(begin,end) + "\nsaveProduct",ctx);
  return {ctx,save,finish,reject,counts:()=>({marked,cached,cleared}),saved};
}

test("unexpected cloud save rejection must preserve the product and complete ES/PL/EN descriptions locally",async()=>{
 const h=harness(),operation=h.save();
 h.reject(new Error("temporary cloud transport failure"));
 await operation;
 assert.equal(h.ctx.menuCatalog.Entradas.length,1);
 const product=h.ctx.menuCatalog.Entradas[0];
 assert.equal(product.description,h.ctx.elements.productDescriptionInput.value.trim());
 assert.equal(product.translations.pl.description,h.ctx.elements.productDescriptionPlInput.value.trim());
 assert.equal(product.translations.en.description,h.ctx.elements.productDescriptionEnInput.value.trim());
 assert.equal(product.price,48);
 assert.equal(h.counts().marked,1);
 assert.equal(h.counts().cached,1);
 assert.equal(h.saved[0].Entradas.length,1);
 assert.equal(h.counts().cleared,0);
 assert.match(h.ctx.alerted,/no lo agregues otra vez/i);
});

test("failed save cannot roll back a different product added during in-flight cloud request",async()=>{
 const h=harness(),operation=h.save();
 h.ctx.menuCatalog.Entradas.push({id:"other-item",name:"Avena",price:15});
 h.reject(new Error("late timeout"));
 await operation;
 assert.deepEqual(h.ctx.menuCatalog.Entradas.map(x=>x.id),["p-tamal","other-item"]);
 assert.equal(h.saved[0].Entradas.length,2);
 assert.equal(h.counts().marked,1);
});

test("a successful cloud save still clears editor without creating an artificial pending revision",async()=>{
 const h=harness(),operation=h.save();
 h.finish({synced:true});
 await operation;
 assert.equal(h.ctx.menuCatalog.Entradas.length,1);
 assert.equal(h.counts().marked,0);
 assert.equal(h.counts().cached,0);
 assert.equal(h.counts().cleared,1);
});
