import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const js = readFileSync("cliente.js", "utf8");
const from = js.indexOf("async function customerHandlePaymentReturn()");
const until = js.indexOf("let customerOrderFlight =", from);
assert.ok(from > 0 && until > from);
const functionSource = js.slice(from, until);
function createHarness(outcome, remoteOrder = "order-a") {
  const messages = [];
  let lookups = 0;
  const params = new URLSearchParams("payment=" + outcome + "&order=" + remoteOrder);
  const context = vm.createContext({
    customerPaymentReturnHandled: false, customerParams: params,
    customerTrackedOrder: {id:"order-a",publicToken:"token-a",total:100},
    customerSetView:()=>{}, customerSetTrackingStatus:(...args)=>messages.push(args),
    customerT:x=>x, customerPollOrderStatus:async()=>{lookups++;return true;},
    customerRenderPaymentBox:()=>{},
    window: {location: {href:"https://example.invalid/cliente.html?payment="+outcome+"&order="+remoteOrder},
    history:{replaceState:()=>{}}}, URL
  });
  vm.runInContext(functionSource,context);
  return {context,messages,lookups:()=>lookups};
}
test("redirect success never represents verified PAID and performs only one status check",async()=>{
 const h=createHarness("success");
 await h.context.customerHandlePaymentReturn();
 assert.equal(h.messages[0][0],"paymentVerificationPending");
 assert.equal(h.messages[0][1],"");
 assert.equal(h.lookups(),1);
 await h.context.customerHandlePaymentReturn();
 assert.equal(h.lookups(),1);
});
test("foreign order redirect cannot change displayed payment status",async()=>{
 const h=createHarness("success","order-b");
 await h.context.customerHandlePaymentReturn();
 assert.equal(h.messages.length,0);
 assert.equal(h.lookups(),0);
});
test("cancel redirect is an error and never reports success",async()=>{
 const h=createHarness("cancelled");
 await h.context.customerHandlePaymentReturn();
 assert.deepEqual(h.messages[0],["paymentCancelled","error"]);
 assert.equal(h.lookups(),0);
});
test("payment verification copy exists for Spanish Polish and English",()=>{
 assert.equal((js.match(/paymentVerificationPending:/g)||[]).length,3);
 const runtime = readFileSync("www/cliente.js","utf8");
 assert.equal(js,runtime);
});
