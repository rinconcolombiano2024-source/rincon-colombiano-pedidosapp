import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source = readFileSync("cliente.js", "utf8");
const functionStart = source.indexOf("async function customerCalculateDistanceWithMaps() {");
const functionEnd = source.indexOf("function customerDeliveryFee() {", functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart);
const functionSource = source.slice(functionStart, functionEnd);
const start = functionSource.indexOf("  const quoteVersion = ++customerDeliveryQuoteGeneration;");
const end = functionSource.indexOf("  customerElements.calculateDistanceButton.disabled = true;", start);
assert.ok(start >= 0 && end > start);
const guard = functionSource.slice(start, end).replace("const isCurrentQuoteRequest =", "var isCurrentQuoteRequest =");

function fixture() {
  const context = vm.createContext({
    customerStoreId:"restaurant-A",
    customerDeliveryQuoteGeneration:0,
    customerLocationCoords:{lat:52.23,lng:21.01},
    customerElements:{orderType:{value:"Domicilio"}},
    destination:"Czapelska 33, Warsaw",
  });
  context.customerDeliveryDestination = () => context.destination;
  vm.runInContext(guard+"\nthis.check=isCurrentQuoteRequest;",context);
  return context;
}
test("a Google Maps quote is valid only for the restaurant, address and GPS used in its request",()=>{
  const c=fixture();
  assert.equal(c.check(),true);
  c.destination="Another address, Warsaw";
  assert.equal(c.check(),false);
});
test("switching restaurants invalidates an outstanding route price",()=>{
  const c=fixture();
  c.customerStoreId="restaurant-B";
  assert.equal(c.check(),false);
});
test("a changed GPS fix invalidates the original road-distance price",()=>{
  const c=fixture();
  c.customerLocationCoords={lat:52.24,lng:21.01};
  assert.equal(c.check(),false);
});
test("a newer quote request supersedes an earlier in-flight request",()=>{
  const c=fixture();
  c.customerDeliveryQuoteGeneration+=1;
  assert.equal(c.check(),false);
});
test("switching to pickup prevents accepting a delivery quote",()=>{
  const c=fixture();
  c.customerElements.orderType.value="Recoger";
  assert.equal(c.check(),false);
});
test("stale success and stale failure cannot overwrite a newer quote",()=>{
  const success=functionSource.indexOf("if (!isCurrentQuoteRequest()) return;");
  const assign= functionSource.indexOf("customerMapDistance = {",success);
  const catchIndex=functionSource.indexOf("} catch (error) {",assign);
  const catchGuard=functionSource.indexOf("if (!isCurrentQuoteRequest()) return;",catchIndex);
  const clear=functionSource.indexOf("customerMapDistance = null;",catchIndex);
  assert.ok(success>0 && assign>success);
  assert.ok(catchGuard>catchIndex && clear>catchGuard);
  assert.match(functionSource,/if \(quoteVersion === customerDeliveryQuoteGeneration\)/);
});
test("manual address changes invalidate in-flight quote even if the user types the original text back",()=>{
  const inputStart=source.indexOf("customerElements.cityInput,",source.indexOf("customerElements.registerAddressInput,"));
  const inputSection=source.slice(inputStart,source.indexOf("customerElements.editProfileButton?",inputStart));
  assert.match(inputSection,/customerDeliveryQuoteGeneration \+= 1;/);
  assert.match(inputSection,/customerMapDistance = null;/);
  assert.match(inputSection,/customerLocationCoords = null;/);
});
test("packaged Android customer code is exactly the audited web source",()=>{
  assert.equal(readFileSync("www/cliente.js","utf8"),source);
});
