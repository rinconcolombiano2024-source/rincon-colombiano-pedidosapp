import test from "node:test";
import assert from "node:assert/strict";
import { reconcileProvider } from "../src/reconcile.mjs";

const pay = (o = {}) => ({ id: "a", provider_reference: "pi_1", amount: "50.00", currency: "PLN", status: "paid", ...o });

test("por defecto varias filas del proveedor siguen siendo AMBIGUAS (no se suman en silencio)", () => {
  const r = reconcileProvider([pay()], [{ event_id: "event_398", reference: "pi_1", amount: "50.00" }, { event_id: "event_438", reference: "pi_1", amount: "-10.00" }]);
  assert.equal(r.ok, false); assert.equal(r.duplicateProvider[0].count, 2);
});
test("con aggregateProviderRows: cargo + reembolso parcial concilia contra amount - refunded_amount", () => {
  const r = reconcileProvider([pay({ refunded_amount: "10.00", status: "partially_refunded" })],
    [{ event_id: "event_773", reference: "pi_1", amount: "50.00", currency: "PLN" }, { event_id: "event_830", reference: "pi_1", amount: "-10.00", currency: "PLN" }], { aggregateProviderRows: true });
  assert.equal(r.ok, true); assert.deepEqual(r.matched, ["pi_1"]);
});
test("con aggregateProviderRows una diferencia de céntimos se detecta", () => {
  const r = reconcileProvider([pay({ refunded_amount: "10.00", status: "partially_refunded" })], [{ event_id: "event_1142", reference: "pi_1", amount: "50.00", currency: "PLN" }, { event_id: "event_1199", reference: "pi_1", amount: "-9.99", currency: "PLN" }], { aggregateProviderRows: true });
  assert.equal(r.ok, false); assert.equal(r.amountMismatch[0].local, 4000); assert.equal(r.amountMismatch[0].provider, 4001);
});
test("monedas mezcladas en las filas agregadas fallan; los duplicados LOCALES nunca se agregan", () => {
  assert.equal(reconcileProvider([pay()], [{ event_id: "event_1569", reference: "pi_1", amount: "40.00", currency: "PLN" }, { event_id: "event_1626", reference: "pi_1", amount: "10.00", currency: "EUR" }], { aggregateProviderRows: true }).currencyMismatch.length, 1);
  const r = reconcileProvider([pay(), pay({ id: "b" })], [{ event_id: "event_1804", reference: "pi_1", amount: "50.00" }], { aggregateProviderRows: true });
  assert.equal(r.ok, false); assert.equal(r.duplicateLocal[0].count, 2);
});

const row=(event_id,amount,reference="pi_1")=>({event_id,amount,reference,currency:"PLN"});
test("aggregation cannot hide missing or repeated provider event identities",()=>{
 for (const rows of [[row(undefined,"50.00"),row(undefined,"-50.00")],[row("same","50.00"),row("same","-50.00")]]) {
  const r=reconcileProvider([pay({status:"refunded",refunded_amount:"50.00"})],rows,{aggregateProviderRows:true});
  assert.equal(r.ok,false);assert.equal(r.matched.length,0);assert.ok(r.invalidProviderEvents.length);
 }
 const r=reconcileProvider([pay(),pay({provider_reference:"pi_2"})],[row("same","50.00"),row("same","50.00","pi_2")],{aggregateProviderRows:true});
 assert.equal(r.ok,false);assert.equal(r.matched.length,0);
});
test("aggregation reports each movement and guards exact sum overflow",()=>{
 const r=reconcileProvider([pay({status:"partially_refunded",refunded_amount:"10.00"})],[row("charge","50.00"),row("refund","-10.00")],{aggregateProviderRows:true});
 assert.deepEqual(r.aggregatedProvider,[{ref:"pi_1",eventIds:["charge","refund"],totalGrosz:4000}]);
 assert.throws(()=>reconcileProvider([pay()],Array.from({length:100},(_,i)=>row("event-"+i,"999999999999.99")),{aggregateProviderRows:true}),{code:"MONEY_OVERFLOW"});
});
test("negative or excessive refunds and paid/refunded status discrepancies cannot reconcile",()=>{
 for(const p of [pay({refunded_amount:"0.00",status:"partially_refunded"}),pay({refunded_amount:"50.00",status:"partially_refunded"}),pay({refunded_amount:"-1.00"}),pay({refunded_amount:"51.00",status:"partially_refunded"}),pay({refunded_amount:"10.00"}),pay({status:"refunded",refunded_amount:"10.00"})]){
  const r=reconcileProvider([p],[row("charge","40.00")],{aggregateProviderRows:true});assert.equal(r.ok,false);
 }
});
