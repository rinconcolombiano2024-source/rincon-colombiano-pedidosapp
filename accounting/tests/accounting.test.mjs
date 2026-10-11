import test from "node:test";
import assert from "node:assert/strict";
import { toGrosz, fromGrosz } from "../src/money.mjs";
import { splitGross, vatSummary, normalizeRate } from "../src/vat.mjs";
import { buildDailyClose, localDate } from "../src/daily-close.mjs";
import { buildMonthlyClose } from "../src/monthly-close.mjs";
import { reconcileProvider } from "../src/reconcile.mjs";

test("toGrosz exacto: numeric, floats problemáticos, rechazo de basura", () => {
  assert.equal(toGrosz("12.50"), 1250); assert.equal(toGrosz(12.5), 1250); assert.equal(toGrosz(0.1 + 0.2), 30);
  assert.equal(toGrosz("-3.05"), -305); assert.equal(toGrosz("7"), 700); assert.equal(fromGrosz(-305), "-3.05");
  for (const bad of ["1,5", "abc", "", NaN, "1.234", null]) assert.throws(() => toGrosz(bad), { code: "INVALID_MONEY" });
});

test("IVA: casos conocidos 23% / 8% / 5% / 0 / ZW y negativos", () => {
  assert.deepEqual(splitGross(1000, "23"), { gross: 1000, net: 813, vat: 187 });
  assert.deepEqual(splitGross(1000, 8), { gross: 1000, net: 926, vat: 74 });
  assert.deepEqual(splitGross(105, "5"), { gross: 105, net: 100, vat: 5 });
  assert.deepEqual(splitGross(500, "ZW"), { gross: 500, net: 500, vat: 0 });
  assert.deepEqual(splitGross(-1000, "23"), { gross: -1000, net: -813, vat: -187 });
  assert.deepEqual(["A", "B", "C", "D", "E", "VAT_23"].map(r=>normalizeRate(r,{A:"23",B:"8",C:"5",D:"0",E:"ZW"})), ["23", "8", "5", "0", "ZW", "23"]);
  assert.throws(() => normalizeRate("19"), { code: "UNKNOWN_VAT_RATE" });
});

test("IVA por suma por tasa, no línea a línea", () => {
  const lines = [{ grossGrosz: 333, vatRate: 23 }, { grossGrosz: 333, vatRate: 23 }, { grossGrosz: 334, vatRate: 23 }];
  const perLine = lines.reduce((a, l) => a + splitGross(l.grossGrosz, 23).vat, 0);
  const s = vatSummary(lines);
  assert.equal(s.gross, 1000); assert.equal(s.vat, 187); assert.notEqual(perLine, s.vat); // línea a línea daría otro IVA: NO es lo legal
  assert.equal(s.net + s.vat, s.gross);
});

test("localDate respeta Europa/Varsovia (frontera de medianoche y cambio horario)", () => {
  assert.equal(localDate("2026-10-09T22:30:00Z"), "2026-10-10"); // CEST UTC+2
  assert.equal(localDate("2026-10-09T21:30:00Z"), "2026-10-09");
  assert.equal(localDate("2026-10-24T22:30:00Z"), "2026-10-25");
  assert.equal(localDate("2026-10-25T22:30:00Z"), "2026-10-25"); // ya CET UTC+1: 23:30 local
});

// --- datos de prueba
const mkOrder = (id, total, extra = {}) => ({ id, status: "delivered", total, currency: "PLN", payment_method: "card", payment_status: "paid",
  created_at: "2026-10-10T10:00:00Z", items: [{ lineTotal: total - 5, vatRate: 8 }], delivery_fee: 5, delivery_vat_rate: 23, ...extra });
const mkPay = (id, orderId, amount, extra = {}) => ({ id, customer_order_id: orderId, status: "paid", amount, currency: "PLN", provider_reference: `pi_${id}`, ...extra });
const mkAlloc = (payId, orderId, gross, restNet, courNet, plat) => ({ payment_transaction_id: payId, customer_order_id: orderId, gross_amount: gross, restaurant_net_amount: restNet, courier_net_amount: courNet, platform_amount: plat });
const opts = { date: "2026-10-10" };

test("cierre diario correcto sin incidencias", () => {
  const c = buildDailyClose({
    orders: [mkOrder("o1", 50), mkOrder("o2", 30, { payment_method: "cash", payment_status: "pending" })],
    payments: [mkPay("p1", "o1", 50)], allocations: [mkAlloc("p1", "o1", 50, 40, 4, 6)],
    refunds: [{ id: "r1", payment_transaction_id: "p1", customer_order_id: "o1", status: "succeeded", amount: 10, vatLines: [{ grossGrosz: 1000, vatRate: 8 }], processed_at: "2026-10-10T12:00:00Z" }],
  }, opts);
  assert.deepEqual(c.issues, []);
  assert.equal(c.orders, 2); assert.equal(c.grossGrosz, 8000); assert.equal(c.refundsGrosz, 1000); assert.equal(c.netAfterRefundsGrosz, 7000);
  assert.deepEqual(c.byPaymentMethod, { card: 5000, cash: 3000 });
  assert.equal(c.split.platformGrosz, 600);
  assert.equal(c.vat.gross, 8000); assert.equal(c.vat.net + c.vat.vat, 8000);
  assert.match(c.checksum, /^[0-9a-f]{64}$/);
  assert.equal(buildDailyClose({ orders: [mkOrder("o1", 50)], payments: [mkPay("p1", "o1", 50)], allocations: [mkAlloc("p1", "o1", 50, 40, 4, 6)] }, opts).checksum,
               buildDailyClose({ orders: [mkOrder("o1", 50)], payments: [mkPay("p1", "o1", 50)], allocations: [mkAlloc("p1", "o1", 50, 40, 4, 6)] }, opts).checksum);
});

test("detecta incidencias: duplicados, reparto roto, reembolso excesivo, falta de asignación y de recibo fiscal", () => {
  const codes = (input, o = opts) => buildDailyClose(input, o).issues.map((i) => i.code);
  assert.ok(codes({ orders: [mkOrder("o1", 50), mkOrder("o1", 50)], payments: [], allocations: [] }).includes("DUPLICATE_ORDER_ID"));
  assert.ok(codes({ orders: [mkOrder("o1", 50)], payments: [mkPay("p1", "o1", 50), mkPay("p2", "o1", 50)], allocations: [] }).includes("DUPLICATE_PAYMENT_FOR_ORDER"));
  assert.ok(codes({ orders: [mkOrder("o1", 50)], payments: [mkPay("p1", "o1", 50)], allocations: [] }).includes("ALLOCATION_MISSING"));
  assert.ok(codes({ orders: [mkOrder("o1", 50)], payments: [mkPay("p1", "o1", 50)], allocations: [mkAlloc("p1", "o1", 50, 40, 4, 5)] }).includes("ALLOCATION_SUM_MISMATCH"));
  assert.ok(codes({ orders: [mkOrder("o1", 50)], payments: [mkPay("p1", "o1", 49.99)], allocations: [] }).includes("PAYMENT_AMOUNT_MISMATCH"));
  assert.ok(codes({ orders: [mkOrder("o1", 50, { items: [{ lineTotal: 10, vatRate: 8 }] })], payments: [mkPay("p1", "o1", 50)], allocations: [mkAlloc("p1", "o1", 50, 40, 4, 6)] }).includes("ORDER_TOTAL_MISMATCH"));
  assert.ok(codes({ orders: [mkOrder("o1", 50)], payments: [mkPay("p1", "o1", 50)], allocations: [mkAlloc("p1", "o1", 50, 40, 4, 6)],
    refunds: [{ id: "r", payment_transaction_id: "p1", status: "succeeded", amount: 51, processed_at: "2026-10-10T09:00:00Z" }] }).includes("REFUND_EXCEEDS_PAYMENT"));
  assert.ok(codes({ orders: [mkOrder("o1", 50)], payments: [mkPay("p1", "o1", 50)], allocations: [mkAlloc("p1", "o1", 50, 40, 4, 6)] }, { ...opts, fiscalRequired: true }).includes("FISCAL_RECEIPT_MISSING"));
  assert.ok(codes({ orders: [mkOrder("o1", 50, { items: [{ lineTotal: 45 }] })], payments: [mkPay("p1", "o1", 50)], allocations: [mkAlloc("p1", "o1", 50, 40, 4, 6)] }).includes("VAT_RATE_MISSING"));
});

test("IVA ausente usa la tasa por defecto SOLO si se configura, y lo marca como asumido", () => {
  const input = { orders: [mkOrder("o1", 50, { items: [{ lineTotal: 45 }], delivery_vat_rate: undefined })], payments: [mkPay("p1", "o1", 50)], allocations: [mkAlloc("p1", "o1", 50, 40, 4, 6)] };
  const c = buildDailyClose(input, { ...opts, defaultVatRate: 8 });
  assert.equal(c.issues.length, 0); assert.ok(c.vatAssumedLines >= 1);
});

test("el pedido de otro día y el cancelado sin pago no cuentan", () => {
  const c = buildDailyClose({ orders: [mkOrder("o1", 50, { created_at: "2026-10-09T10:00:00Z" }), mkOrder("o2", 30, { status: "cancelled", payment_method: "cash", payment_status: "pending" })], payments: [mkPay("p1", "o1", 50)], allocations: [] }, opts);
  assert.equal(c.orders, 0);
});

test("propiedad: 800 pedidos aleatorios cuadran al grosz (reparto, IVA, totales)", () => {
  let seed = 123456789; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const orders = [], payments = [], allocations = []; let expected = 0;
  for (let i = 0; i < 800; i++) {
    const gross = Math.round((5 + rnd() * 195) * 100); const fee = Math.min(gross - 1, Math.round(300 + rnd() * 500));
    const id = `o${i}`, pid = `p${i}`;
    const itemsG = gross - fee; const rate = [23, 8, 5, 0, "ZW"][Math.floor(rnd() * 5)];
    orders.push({ id, status: "delivered", total: fromGrosz(gross), currency: "PLN", payment_method: "card", payment_status: "paid",
      created_at: "2026-10-10T11:00:00Z", items: [{ lineTotal: fromGrosz(itemsG), vatRate: rate }], delivery_fee: fromGrosz(fee), delivery_vat_rate: 23 });
    payments.push(mkPay(pid, id, fromGrosz(gross)));
    const plat = Math.round(gross * 0.1), courNet = fee - Math.round(fee * 0.1), restNet = gross - plat - courNet;
    allocations.push(mkAlloc(pid, id, fromGrosz(gross), fromGrosz(restNet), fromGrosz(courNet), fromGrosz(plat)));
    expected += gross;
  }
  const c = buildDailyClose({ orders, payments, allocations }, opts);
  assert.deepEqual(c.issues, []); assert.equal(c.grossGrosz, expected);
  assert.equal(c.split.platformGrosz + c.split.restaurantNetGrosz + c.split.courierNetGrosz, expected);
  assert.equal(c.vat.net + c.vat.vat, c.vat.gross); assert.equal(c.vat.gross, expected);
  for (const v of Object.values(c.vat.byRate)) assert.equal(v.net + v.vat, v.gross);
});

test("cierre mensual: suma, días faltantes, sellado y detección de duplicados", () => {
  const day = (d, gross, issues = []) => buildDailyClose({ orders: [mkOrder(`o${d}`, gross, { created_at: `2026-10-${d}T10:00:00Z` })], payments: [mkPay(`p${d}`, `o${d}`, gross)],
    allocations: [mkAlloc(`p${d}`, `o${d}`, gross, gross - 8, 4, 4)] }, { date: `2026-10-${d}` });
  const days = [day("10", 50), day("11", 70)];
  const m = buildMonthlyClose(days, "2026-10");
  assert.equal(m.grossGrosz, 12000); assert.equal(m.days, 2); assert.equal(m.missingDays.length, 29); assert.equal(m.complete, false);
  assert.equal(m.sealed, buildMonthlyClose(days, "2026-10").sealed);
  assert.notEqual(m.sealed, buildMonthlyClose([day("10", 51), day("11", 70)], "2026-10").sealed);
  assert.throws(() => buildMonthlyClose([days[0], days[0]], "2026-10"), { code: "DUPLICATE_DAY" });
});

test("conciliación con el proveedor: coincide, faltantes, importe distinto", () => {
  const local = [mkPay("a", "o1", 10), mkPay("b", "o2", 20), mkPay("c", "o3", 30), mkPay("d", "o4", 5, { status: "pending" })];
  const prov = [{ reference: "pi_a", amount: "10.00", currency:"PLN" }, { reference: "pi_b", amount: "19.99", currency:"PLN" }, { reference: "pi_zzz", amount: "7.00", currency:"PLN" }];
  const r = reconcileProvider(local, prov);
  assert.deepEqual(r.matched, ["pi_a"]); assert.deepEqual(r.missingInProvider, ["pi_c"]); assert.deepEqual(r.missingLocal, ["pi_zzz"]);
  assert.equal(r.amountMismatch[0].ref, "pi_b"); assert.equal(r.ok, false);
  assert.equal(reconcileProvider([mkPay("a", "o1", 10)], [{ reference: "pi_a", amount: 10, currency:"PLN" }]).ok, true);
});

import { fromCustomerOrderRow, fromPaymentRow } from "../src/adapters.mjs";
test("adaptador de filas reales: usa snapshots del RPC V91-70 y métodos de pago de la app", () => {
  const row = { id: "o1", status: "delivered", total: "29.50", currency: "PLN", payment_method: "Pago al recoger", payment_status: "pending",
    created_at: "2026-10-10T10:00:00Z", final_delivery_fee: "5.00",
    order_json: { items: [{ total_snapshot: 24.5, vat_rate_snapshot: "8", quantity: 1 }] } };
  const c = buildDailyClose({ orders: [fromCustomerOrderRow(row)], payments: [], allocations: [] }, { date: "2026-10-10", defaultVatRate: 23 });
  assert.equal(c.orders, 1); assert.equal(c.grossGrosz, 2950);
  assert.deepEqual(c.byPaymentMethod, { "pago al recoger": 2950 });
  assert.equal(c.vat.byRate["8"].gross, 2450); assert.equal(c.vat.byRate["23"].gross, 500); // envío al 23% por defecto
  const old = { ...row, order_json: { items: [{ total_snapshot: 24.5 }] } };
  assert.ok(buildDailyClose({ orders: [fromCustomerOrderRow(old)], payments: [], allocations: [] }, { date: "2026-10-10" }).issues.some((i) => i.code === "VAT_RATE_MISSING"));
});

test("Supabase payment adapter preserves refund amount through reconciliation", () => {
 const p = fromPaymentRow({id:"p",customer_order_id:"o",status:"partially_refunded",amount:"50.00",refunded_amount:"10.00",currency:"PLN",provider_reference:"pi"});
 assert.equal(p.refunded_amount,"10.00");
 assert.equal(reconcileProvider([p],[{reference:"pi",amount:"40.00",currency:"PLN"}]).ok,true);
 assert.equal(reconcileProvider([p],[{reference:"pi",amount:"50.00",currency:"PLN"}]).ok,false);
});
