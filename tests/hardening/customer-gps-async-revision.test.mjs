import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync("cliente.js", "utf8");
test("GPS stale-response guard has byte-identical Android/web distribution", () => {
  assert.equal(source, readFileSync("www/cliente.js", "utf8"));
});
const start=source.indexOf("async function customerReverseGeocodeLocation(");
const end=source.indexOf("function customerGeocodeAddressForMap(", start);
assert.ok(start > 0 && end > start);
const functionSource=source.slice(start,end);

async function quoteWithLateReverseGeocode(mutate) {
  const initial={lat:52.24,lng:21.09};
  let callback;
  let renderCalls=0;
  const context={
    customerStoreId:"restaurant-one",
    customerLocationCoords:{...initial},
    customerSettings:{googleMapsApiKey:"placeholder-key"},
    customerElements:{orderType:{value:"Domicilio"},addressInput:{value:"New address 12"}},
    customerLoadGoogleMaps:()=>Promise.resolve(),
    google:{maps:{Geocoder:class {geocode(_params, cb){callback=cb;}}}},
    customerRenderLocationSummary:()=>renderCalls++,
    customerRenderProfileDetails:()=>renderCalls++,
    customerRenderCart:()=>renderCalls++
  };
  vm.createContext(context);
  const reverse=vm.runInContext(functionSource+"\ncustomerReverseGeocodeLocation",context);
  const promise=reverse(initial);
  await Promise.resolve();
  assert.equal(typeof callback,"function","geocoding callback registered");
  mutate(context);
  callback([{formatted_address:"Old street, Warsaw"}],"OK");
  assert.equal(await promise,false);
  assert.equal(context.customerElements.addressInput.value,"New address 12");
  assert.equal(renderCalls,0);
}
test("typing a different delivery address while reverse geocoding prevents old GPS overwrite",async()=>{
  await quoteWithLateReverseGeocode(c=>{c.customerLocationCoords=null;});
});
test("moving the pin while reverse geocoding prevents old coordinates overwrite",async()=>{
  await quoteWithLateReverseGeocode(c=>{c.customerLocationCoords={lat:52.21,lng:21.07};});
});
test("switching restaurant while reverse geocoding prevents cross-restaurant address overwrite",async()=>{
  await quoteWithLateReverseGeocode(c=>{c.customerStoreId="restaurant-two";});
});
test("a late browser GPS permission response cannot overwrite manually edited address",()=>{
  const start=source.indexOf("async function customerUseLocation()");
  const end=source.indexOf("async function customerCalculateDistanceWithMaps()",start);
  const body=source.slice(start,end);
  assert.match(body,/requestedQuoteGeneration !== customerDeliveryQuoteGeneration/);
  assert.match(body,/requestedDestination !== customerDeliveryDestination\(\)/);
  assert.match(body,/previousCoordinates !== JSON.stringify\(customerLocationCoords\)/);
  assert.ok(body.indexOf("requestedQuoteGeneration !== customerDeliveryQuoteGeneration")<body.indexOf("customerLocationCoords = {"));
});
