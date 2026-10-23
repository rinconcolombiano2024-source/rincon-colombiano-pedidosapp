"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("cliente.js","utf8");
assert.equal(source,fs.readFileSync("www/cliente.js","utf8"),"web/Android source must match");
const start=source.indexOf("async function customerSendOrderRequest() {");
const end=source.indexOf('customerElements.categoryTabs.addEventListener("click"',start);
assert.ok(start>0 && end>start, "real customer checkout handler exists");
const handler=source.slice(start,end);
function harness(overrides={}) {
  const calls=[],warnings=[],status=[],u={id:"customer-a",email:"customer@example.test"},r={operationalOpen:true,countryCode:"PL",region:"Mazowieckie"};
  const input=value=>({value,disabled:false,focus(){}});
  const elements={
    tableInput:input("Mesa 2"),nameInput:input("Cliente prueba"),orderType:input("Recoger en el punto"),
    paymentMethod:input("Efectivo"),notesInput:input(""),phoneInput:input("123"),
    sendButton:input(""),distanceInput:input(""),status:{textContent:""},
  };
  const ctx={
    customerClient:{},customerStoreId:"restaurant-one",customerUser:u,
    customerCart:[{id:"dish-a",productId:"dish-a",qty:2,price:15,name:"Arepas",description:"Con queso",note:"sin cebolla",station:"kitchen"}],
    customerElements:elements,customerRegistrationRegion:{countryCode:"PL",region:"Mazowieckie"},
    customerSettings:{restaurantOperationalOpen:true},customerMapDistance:null,customerLocationCoords:null,customerTrackedOrder:null,
    customerSelectedRestaurant:()=>r,customerNormalizeSearchText:x=>String(x).toLowerCase(),
    customerCanonicalDirectoryRegion:(_,x)=>x,customerValidateOrderData:()=>true,
    customerDeliveryPayload:()=>null,customerNormalizeNote:x=>String(x).trim().toUpperCase(),
    customerNormalizeProductStation:x=>x,customerLineName:x=>x.name,customerCartTotal:()=>30,
    customerSaveProfile:async()=>{calls.push("profile");if(overrides.profile) return overrides.profile(ctx);},
    customerCreateCustomerOrder:async(payload,total)=>{calls.push("gateway");assert.equal(total,30);assert.equal(payload.items.length,1);assert.equal(payload.items[0].options_snapshot.note,"SIN CEBOLLA");if(overrides.gateway) return overrides.gateway(ctx);return {id:"order-1",publicToken:"proof-1",trackingAvailable:false,payload};},
    customerLoadRestaurantDirectory:async()=>{},customerLoadMenu:async()=>{},
    customerT:x=>x,customerSetStatus:(t)=>{status.push(t);elements.status.textContent=t;},
    customerClearPaymentBox:()=>{},customerRenderDeliveryFields:()=>{},customerRenderCart:()=>{},
    customerSetTrackingStatus:()=>{},customerRenderPaymentBox:()=>{calls.push("render-payment");},
    customerLoadHistory:async()=>{},customerCloseHeaderCart:()=>{},customerSetView:v=>{calls.push("view:"+v);},
    customerStartOnlinePayment:async()=>{calls.push("checkout");},
    console:{warn:(...args)=>warnings.push(args),error:()=>{}}
  };
  vm.createContext(ctx);
  vm.runInContext(handler,ctx);
  return {ctx,calls,warnings,status,elements,run:()=>ctx.customerSendOrderRequest()};
}
test("profile failure does not block a valid order, cart snapshot or cashier route",async()=>{
 const h=harness({profile:async()=>{throw new Error("Auth metadata unavailable");}});
 await h.run();
 assert.deepEqual(h.calls,["profile","gateway","render-payment","view:orders"]);
 assert.equal(h.ctx.customerCart.length,0);
 assert.equal(h.status.at(-1),"orderSent");
 assert.equal(h.warnings.length,1);
});
test("successful profile save still runs before the authenticated order gateway",async()=>{
 const h=harness();await h.run();
 assert.deepEqual(h.calls.slice(0,2),["profile","gateway"]);
 assert.equal(h.warnings.length,0);
});
test("changing the signed-in user during profile persistence still blocks order submission",async()=>{
 const h=harness({profile:async ctx=>{ctx.customerUser={id:"other-user"};throw new Error("session revoked");}});
 await h.run();
 assert.deepEqual(h.calls,["profile"]);
 assert.equal(h.ctx.customerCart.length,1);
 assert.equal(h.status.at(-1),"orderSessionChanged");
});
test("gateway refusal remains fatal and keeps cart even if profile was optional",async()=>{
 const h=harness({profile:async()=>{throw Error("metadata denied");},gateway:async()=>{throw Error("ORDER_RATE_LIMITED");}});
 await h.run();
 assert.deepEqual(h.calls,["profile","gateway"]);
 assert.equal(h.ctx.customerCart.length,1);
 assert.equal(h.status.at(-1),"orderRateLimited");
});
test("online provider handoff still occurs exactly once on successful order",async()=>{
 const h=harness({profile:async()=>{throw Error("profile sync temporary");}});
 h.elements.paymentMethod.value="Online";
 await h.run();
 assert.deepEqual(h.calls.filter(x=>x==="checkout"),["checkout"]);
 assert.equal(h.ctx.customerCart.length,0);
});