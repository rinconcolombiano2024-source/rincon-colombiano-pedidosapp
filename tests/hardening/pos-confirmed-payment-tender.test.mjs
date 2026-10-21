import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync("app.js","utf8");
const marker='  const paymentMethod = normalizePaymentMethod(savedOrders[index].paymentMethod);';
const start=source.indexOf('  const nextStatus = normalizePaymentStatus(status, "pending");',source.indexOf('async function updateTicketPaymentStatus('));
const end=source.indexOf('  savedOrders[index].paymentStatus = nextStatus;',start);
assert.ok(start>=0&&end>start&&source.slice(start,end).includes(marker));
const guard=source.slice(start,end).replace(/\breturn;/g,'throw new Error("PAYMENT_TENDER_UNVERIFIED");');
function check(tender,status="paid"){
 const state={savedOrders:[{paymentMethod:tender}],index:0,status,
   normalizePaymentStatus:(s)=>s,normalizePaymentMethod:(m)=>m,alert:()=>{}};
 vm.runInNewContext(guard,state);
}
test("manual paid toggle rejects generic pay-at-counter placeholder",()=>assert.throws(()=>check("Pago en caja"),/PAYMENT_TENDER_UNVERIFIED/));
test("manual paid toggle cannot override an online provider webhook",()=>assert.throws(()=>check("Online"),/PAYMENT_TENDER_UNVERIFIED/));
test("physical tenders and resetting pending remain usable",()=>{
 for(const tender of ["Efectivo","Datafono","Transferencia"])assert.doesNotThrow(()=>check(tender));
 assert.doesNotThrow(()=>check("Pago en caja","pending"));
});
test("web and packaged Android payment guard are byte identical",()=>assert.equal(readFileSync("app.js","utf8"),readFileSync("www/app.js","utf8")));
