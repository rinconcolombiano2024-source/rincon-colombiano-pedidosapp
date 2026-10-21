import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const source=readFileSync("app.js","utf8");
const start=source.indexOf("  const paymentGroups = report.paymentMethods || [];",source.indexOf("async function printDailyClose()"));
const end=source.indexOf("  if (!report.tickets)",start);
assert.ok(start>=0&&end>start);
const guard=source.slice(start,end);
function check(report){vm.runInNewContext(guard,{report});}
test("daily close accepts fully allocated payment methods",()=>assert.doesNotThrow(()=>check({tickets:2,paymentMethods:[{label:"Efectivo",tickets:1},{label:"Tarjeta",tickets:1}]})));
test("daily close rejects missing payment method",()=>assert.throws(()=>check({tickets:2,paymentMethods:[{label:"Efectivo",tickets:1},{label:"No indicado",tickets:1}]}),/No se puede cerrar/));
test("daily close rejects incomplete report totals",()=>assert.throws(()=>check({tickets:2,paymentMethods:[{label:"Efectivo",tickets:1}]}),/No se puede cerrar/));
