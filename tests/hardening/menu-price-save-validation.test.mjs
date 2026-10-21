import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const source=readFileSync("app.js","utf8");
const start=source.indexOf("  const priceInput = String(elements.productPriceInput.value");
const end=source.indexOf("  let imageUrl =",start);
assert.ok(start>=0&&end>start);
const block=source.slice(start,end).replace("    return;","    throw new Error('INVALID_PRICE');");
function parse(value){const context=vm.createContext({elements:{productPriceInput:{value}},alert:()=>{},window:{RC_ORDERA_OFFLINE_I18N:{translate:()=>""}},currentAppLanguage:()=>"es"});vm.runInContext(block+"\nthis.result=price;",context);return context.result;}
test("valid menu prices retain exact numeric value",()=>{assert.equal(parse("60"),60);assert.equal(parse("12.50"),12.5);assert.equal(parse("0"),0);});
test("invalid menu prices never silently overwrite existing price with zero",()=>{for(const input of [""," ","abc","-1","12abc","Infinity",null])assert.throws(()=>parse(input),/INVALID_PRICE/);});
