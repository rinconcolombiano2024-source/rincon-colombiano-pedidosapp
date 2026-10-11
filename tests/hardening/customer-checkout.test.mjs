import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('cliente.js','utf8');
function harness(){
 let release;const gate=new Promise(r=>release=r);let saves=0,creates=0;
 const field=value=>({value,disabled:false,textContent:'',setAttribute(){}});
 const elements={tableInput:field('T'),nameInput:field('Test'),orderType:field('Recoger'),paymentMethod:field('Cash'),notesInput:field(''),distanceInput:field(''),sendButton:field(''),status:field(''),cartItems:{querySelectorAll:()=>[]}};
 const c=vm.createContext({console:{error(){}},customerElements:elements,customerClient:{},customerStoreId:'A',customerUser:{id:'user-A'},customerCart:[{id:'dish',qty:1,price:10}],customerSelectedRestaurant:()=>({operationalOpen:true}),customerRegistrationRegion:{},customerValidateOrderData:()=>true,customerDeliveryPayload:()=>null,customerNormalizeNote:s=>s,customerLineName:()=> 'Dish',customerNormalizeProductStation:()=> 'kitchen',customerCartTotal:()=>10,customerT:k=>k,customerSetStatus:t=>elements.status.textContent=t,customerClearPaymentBox(){},customerSaveProfile:async()=>{saves++;await gate;},customerCreateCustomerOrder:async()=>{creates++;return null;},customerRenderCart(){},customerLoadRestaurantDirectory:async()=>{},customerLoadMenu:async()=>{}});
 let start=source.indexOf('let customerCheckoutBusy =');if(start<0)start=source.indexOf('async function customerSendOrder()');
 vm.runInContext(source.slice(start,source.indexOf('customerElements.categoryTabs.addEventListener',start)),c);
 return {c,elements,release,stats:()=>({saves,creates})};
}
test('checkout shares the entire submission lock including asynchronous profile save',async()=>{
 const h=harness();const pending=Array.from({length:20},()=>h.c.customerSendOrder());
 assert.equal(h.stats().saves,1);h.release();await Promise.all(pending);
 assert.equal(h.stats().creates,1);assert.equal(h.elements.sendButton.disabled,false);
});
test('checkout refuses a different restaurant after profile save before order creation',async()=>{
 const h=harness();const p=h.c.customerSendOrder();h.c.customerStoreId='B';h.release();await p;
 assert.equal(h.stats().creates,0);assert.equal(h.elements.sendButton.disabled,false);
});
test('checkout refuses a different user after profile save and releases controls for retry',async()=>{
 const h=harness();const p=h.c.customerSendOrder();h.c.customerUser={id:'user-B'};h.release();await p;
 assert.equal(h.stats().creates,0);await h.c.customerSendOrder();assert.equal(h.stats().creates,1);
});
test('checkout visibly locks fields, restores their original disabled state and rejects cart additions',async()=>{
 const h=harness();h.elements.distanceInput.disabled=true;
 const begin=source.indexOf('function customerAddItem('),end=source.indexOf('function customerFindCurrentMenuProduct(',begin);
 vm.runInContext(source.slice(begin,end),h.c);
 const p=h.c.customerSendOrder();assert.equal(h.elements.nameInput.disabled,true);
 assert.equal(h.elements.sendButton.textContent,'sendingOrder');
 h.c.customerAddItem({name:'Extra'});assert.equal(h.c.customerCart.length,1);
 h.c.customerRenderCheckoutState();assert.equal(h.elements.sendButton.disabled,true);
 h.release();await p;assert.equal(h.elements.nameInput.disabled,false);
 assert.equal(h.elements.distanceInput.disabled,true);assert.equal(h.elements.sendButton.textContent,'sendOrder');
});
