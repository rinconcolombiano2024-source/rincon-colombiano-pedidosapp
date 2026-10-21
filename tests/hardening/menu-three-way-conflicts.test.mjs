import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync("app.js","utf8");
const start=source.indexOf("function mergeConcurrentMenuChanges(");
const end=source.indexOf("function pendingTicketCounter()",start);
assert.ok(start>0&&end>start);
const sandbox={
  normalizeMenuCatalog(menu){return menu;},
  menuProductEntries(menu){
    const entries=new Map();
    for(const [category,products] of Object.entries(menu))
      products.forEach((product,index)=>entries.set(product.id,{category,index,product}));
    return entries;
  },
  menuProductEntryMatches(first,second){
    if(!first||!second)return first===second;
    return first.category===second.category&&JSON.stringify(first.product)===JSON.stringify(second.product);
  },
  appUiText(message){return message;},
};
vm.createContext(sandbox);
vm.runInContext(source.slice(start,end)+"\nglobalThis.merge=mergeConcurrentMenuChanges;",sandbox);
const merge=sandbox.merge;
const a=(description,price=35)=>({id:"tamal",name:"Tamal",description,price,translations:{es:{description},pl:{description:"Polski "+description},en:{description:"English "+description}}});
const b=(price,description="Café fresco")=>({id:"cafe",name:"Café",description,price});
const base={Comida:[a("Receta original"),b(12)]};
const copy=value=>JSON.parse(JSON.stringify(value));
test("independent product edits merge and preserve long ES/PL/EN descriptions",()=>{
 const long="Arepa con queso ñ Ż 🌽 ".repeat(230);
 const result=copy(merge(base,{Comida:[a(long),b(12)]},{Comida:[a("Receta original"),b(15)]}));
 assert.equal(result.Comida[0].description,long);
 assert.equal(result.Comida[0].translations.pl.description,"Polski "+long);
 assert.equal(result.Comida[0].translations.en.description,"English "+long);
 assert.equal(result.Comida[1].price,15);
});
test("concurrent changes on the same product never silently overwrite remote price",()=>{
 assert.throws(()=>merge(base,{Comida:[a("Local nueva"),b(12)]},{Comida:[a("Receta original",42),b(12)]}),error=>error.code==="MENU_CONFLICT_REQUIRES_REFRESH");
});
test("local edit cannot silently resurrect remote deletion",()=>{
 assert.throws(()=>merge(base,{Comida:[a("Local nueva"),b(12)]},{Comida:[b(12)]}),error=>error.code==="MENU_CONFLICT_REQUIRES_REFRESH");
});
test("local deletion cannot silently discard a remote edit",()=>{
 assert.throws(()=>merge(base,{Comida:[b(12)]},{Comida:[a("Remote nueva"),b(12)]}),error=>error.code==="MENU_CONFLICT_REQUIRES_REFRESH");
});
test("identical concurrent edits converge safely",()=>{
 const change={Comida:[a("Mismo cambio"),b(12)]};
 assert.equal(copy(merge(base,change,change)).Comida[0].description,"Mismo cambio");
});
test("independent product deletions remain mergeable",()=>{
 assert.equal(copy(merge(base,{Comida:[b(12)]},{Comida:[a("Receta original")]})).Comida,undefined);
});
