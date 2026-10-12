'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const code = fs.readFileSync(path.join(root,'app.js'),'utf8');
const source = code.slice(code.indexOf('async function performClientOrdersRefresh('),
                          code.indexOf('function clientOrderItems(',code.indexOf('async function performClientOrdersRefresh(')));
const courierFn = code.slice(code.indexOf('function clientOrderNeedsCourier('),
                             code.indexOf('function clientOrderCanRequestCourier(',code.indexOf('function clientOrderNeedsCourier(')));
assert.ok(source.startsWith('async function performClientOrdersRefresh('));
assert.ok(courierFn.startsWith('function clientOrderNeedsCourier('));

async function scenario(rows, failure = null) {
  let trackingRpcCalls = 0, orderReads = 0, rendered = 0;
  const client = {
    from(table) {
      assert.equal(table,'customer_orders');
      const query={};
      for(const key of ['select','eq','in','order','limit','or']) query[key]=()=>query;
      query.then = (ok,bad)=>{orderReads++;return Promise.resolve({data:rows,error:failure}).then(ok,bad)};
      return query;
    }
  };
  const globals={
    cloudState:{client,user:{id:'restaurant-a'}},
    pendingClientOrders:[],
    clientDeliveryTrackingByOrderId:new Map(),
    elements:{clientOrdersDialog:{open:false},clientOrdersList:{innerHTML:''}},
    navigator:{onLine:true},
    canUseCustomerModule:()=>true,
    normalizeOrderType:raw=>raw,
    withCloudTimeout:async request=>request,
    loadCurrentRestaurantDeliveryTracking:async()=>{trackingRpcCalls++;return new Map([['delivery-1',{courier_name:'Test rider'}]])},
    updateClientOrdersBadge:()=>{},
    renderClientOrders:()=>{rendered++},
    showToast:()=>{throw Error('unexpected toast')},
    showRestaurantNotification:()=>{throw Error('unexpected notification')},
    syncClientAlarm:()=>{throw Error('unexpected alarm')},
    Map, Set, console
  };
  const ctx=vm.createContext(globals);
  vm.runInContext(source+'\n'+courierFn,ctx);
  let caught=null;
  try { await vm.runInContext('performClientOrdersRefresh({silent:true})',ctx) } catch(error){caught=error}
  return {trackingRpcCalls,orderReads,rendered,pending:ctx.pendingClientOrders,caught};
}
const pickup=(id)=>({id,status:'accepted',order_type:'Recoger',order_json:{type:'Recoger'}});
const delivery=(id)=>({id,status:'accepted',order_type:'Domicilio',order_json:{type:'Domicilio'}});

test('empty order list fetches once, no courier tracking RPC',async()=>{
  const r=await scenario([]);
  assert.equal(r.orderReads,1);assert.equal(r.trackingRpcCalls,0);assert.equal(r.rendered,1);assert.equal(r.pending.length,0);
});
test('pickup and waiter orders avoid tracking RPC without losing orders',async()=>{
  const r=await scenario([pickup('pickup-1'),pickup('waiter-1')]);
  assert.equal(r.orderReads,1);assert.equal(r.trackingRpcCalls,0);assert.equal(r.pending.length,2);
});
test('active delivery fetches tracking and preserves courier assignment UI data',async()=>{
  const r=await scenario([pickup('pickup-1'),delivery('delivery-1')]);
  assert.equal(r.orderReads,1);assert.equal(r.trackingRpcCalls,1);
  assert.equal(r.pending.find(x=>x.id==='delivery-1').deliveryTracking.courier_name,'Test rider');
});
test('failed orders fetch never triggers a redundant tracking RPC',async()=>{
  const r=await scenario([],Object.assign(new Error('timeout'),{code:'PGRST_TIMEOUT'}));
  assert.ok(r.caught);assert.equal(r.orderReads,1);assert.equal(r.trackingRpcCalls,0);assert.equal(r.rendered,0);
});
test('published app matches protected source and never tracks unconditionally',()=>{
  assert.equal(code,fs.readFileSync(path.join(root,'www/app.js'),'utf8'));
  assert.match(source,/const tracking = orders.some\(clientOrderNeedsCourier\)/);
  assert.doesNotMatch(source,/Promise\.all\(\[\s*ordersRequest,\s*trackingRequest/);
});
