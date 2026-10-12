/**
 * Cierre diario. Entrada CANÓNICA (adapta tus filas de Supabase a esta forma):
 *  orders:   { id, status, total, currency, payment_method, payment_status, created_at, channel?, delivery_fee?,
 *              items?: [{ lineTotal, vatRate? }] }
 *  payments: { id, customer_order_id, status, amount, currency, provider_reference?, paid_at? }
 *  refunds:  { id, payment_transaction_id, customer_order_id, status, amount, processed_at? }
 *  allocations: { payment_transaction_id, customer_order_id, gross_amount, restaurant_net_amount, courier_net_amount,
 *                 platform_amount, restaurant_fee_amount, courier_fee_amount }
 *  fiscalOps: { order_id, state }   (opcional)
 * Venta reconocida: pedido pagado online (payment_status 'paid') o pedido en efectivo/terminal entregado.
 */
import { createHash } from "node:crypto";
import { AccountingError, toGrosz, fromGrosz, sum } from "./money.mjs";
import { vatSummary, normalizeRate } from "./vat.mjs";

const dateFormatters = new Map();
function dateFormatter(timeZone) {
  let formatter=dateFormatters.get(timeZone);
  if(!formatter){
    formatter=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"});
    if(dateFormatters.size>=8)dateFormatters.delete(dateFormatters.keys().next().value);
    dateFormatters.set(timeZone,formatter);
  }
  return formatter;
}
export function localDate(ts, timeZone = "Europe/Warsaw") {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) throw new AccountingError("INVALID_TIMESTAMP", "Invalid timestamp");
  return dateFormatter(timeZone).format(d);
}
// Métodos reales de la app (RPC de pedidos): Efectivo, Transferencia, Datafono, Pago en caja, Pago al recoger, Online.
const OFFLINE = new Set(["cash", "efectivo", "gotowka", "terminal", "card_terminal", "datafono", "pago en caja", "pago al recoger", "transferencia"]);
const norm = (m) => String(m ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const isOffline = (m) => OFFLINE.has(norm(m));
const REFUND_DONE = new Set(["succeeded", "refunded", "completed", "processed"]);

export function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

export function buildDailyClose(input, { date, timeZone = "Europe/Warsaw", defaultVatRate = null, fiscalRequired = false } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new AccountingError("INVALID_DATE", "date must be YYYY-MM-DD");
  if (Number.isNaN(Date.parse(date+"T00:00:00Z")) || new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date) throw new AccountingError("INVALID_DATE", "Invalid calendar date");
  const issues = [];
  const issue = (code, ref, detail = "") => issues.push({ code, ref, detail });
  let { orders = [], payments = [], refunds = [], allocations = [], fiscalOps = [] } = input;

  for(const rows of [orders,payments,refunds,allocations,fiscalOps])if(!Array.isArray(rows))throw new AccountingError("INVALID_INPUT","Expected arrays of audit records");

  // Ambiguous duplicate records are excluded and explicitly invalidate the audit.
  function unambiguous(rows, field, code) {
    rows = rows.filter(row=>{if(!row || typeof row[field]!=="string" || !row[field].trim() || row[field]!==row[field].trim()){issue("INVALID_RECORD_ID",field);return false;}return true;});
    const counts = new Map(); for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
    for (const [id, n] of counts) if (n > 1) issue(code, id, `${n} records excluded`);
    return rows.filter(row => counts.get(row[field]) === 1);
  }
  orders = unambiguous(orders, "id", "DUPLICATE_ORDER_ID");
  payments = unambiguous(payments, "id", "DUPLICATE_PAYMENT_ID");
  refunds = unambiguous(refunds, "id", "DUPLICATE_REFUND_ID");
  allocations = unambiguous(allocations, "payment_transaction_id", "DUPLICATE_ALLOCATION");
  const references = new Map();
  for (const pay of payments) if (pay.provider_reference) references.set(pay.provider_reference, (references.get(pay.provider_reference) ?? 0) + 1);
  for (const [ref, n] of references) if (n > 1) issue("DUPLICATE_PROVIDER_REFERENCE", ref);

  const paymentsByOrder = new Map();
  for (const p of payments) {
    if (p.currency !== "PLN") issue("CURRENCY_NOT_PLN", p.id, p.currency);
    if (!paymentsByOrder.has(p.customer_order_id)) paymentsByOrder.set(p.customer_order_id, []);
    paymentsByOrder.get(p.customer_order_id).push(p);
  }
  const allocByPayment = new Map(allocations.map((a) => [a.payment_transaction_id, a]));
  const fiscalOk = new Set(fiscalOps.filter((f) => f.state === "confirmed" && f.fiscal === true && f.simulated !== true).map((f) => f.order_id));

  const totals = { orders: 0, grossGrosz: 0, byPaymentMethod: {}, byChannel: {} };
  const vatDocuments = [];
  const refundVatDocuments = [];
  const quantitiesByProduct = {};
  function increment(object, key, amount) {
    const n = (Object.hasOwn(object, key) ? object[key] : 0) + amount;
    if (!Number.isSafeInteger(n)) throw new AccountingError("MONEY_OVERFLOW", "Unsafe accumulated value");
    Object.defineProperty(object, key, {value:n,enumerable:true,writable:true,configurable:true});
  }
  const soldOrderIds = new Set();
  let vatAssumed = 0;

  for (const o of orders) {
    if (o.currency !== "PLN") { issue("CURRENCY_NOT_PLN", o.id, o.currency); continue; }
    const paid = (paymentsByOrder.get(o.id) ?? []).filter((p) => p.status === "paid" || p.status === "partially_refunded" || p.status === "refunded");
    const online = o.payment_status === "paid" || paid.length > 0;
    const offlineSale = isOffline(o.payment_method) && o.status === "delivered";
    if (!online && !offlineSale) continue;
    if (localDate(o.created_at, timeZone) !== date) continue;

    const total = toGrosz(o.total);
    soldOrderIds.add(o.id);
    const vatLines = [];
    totals.orders += 1; increment(totals, "grossGrosz", total);
    const method = norm(o.payment_method) || "unknown";
    increment(totals.byPaymentMethod, method, total);
    const channel = o.channel || "own_app";
    increment(totals.byChannel, channel, total);

    if (paid.length > 1) issue("DUPLICATE_PAYMENT_FOR_ORDER", o.id, `${paid.length} pagos`);
    if (online && !isOffline(o.payment_method)) {
      const p = paid[0];
      if (!p) issue("PAID_ORDER_WITHOUT_PAYMENT", o.id);
      else {
        if (toGrosz(p.amount) !== total) issue("PAYMENT_AMOUNT_MISMATCH", o.id, `${p.amount} vs ${o.total}`);
        const a = allocByPayment.get(p.id);
        if (!a) issue("ALLOCATION_MISSING", o.id);
        else if (sum([toGrosz(a.restaurant_net_amount), toGrosz(a.courier_net_amount), toGrosz(a.platform_amount)]) !== toGrosz(a.gross_amount)) issue("ALLOCATION_SUM_MISMATCH", o.id);
        else if (toGrosz(a.gross_amount) !== total) issue("ALLOCATION_GROSS_MISMATCH", o.id);
      }
    }
    if (fiscalRequired && !fiscalOk.has(o.id)) issue("FISCAL_RECEIPT_MISSING", o.id);

    // Líneas para IVA: items + envío. Sin IVA por línea => defaultVatRate (marcado como asumido) o error.
    const items = Array.isArray(o.items) ? o.items : null;
    if (items) {
      const itemsTotal = sum([sum(items, (i) => toGrosz(i.lineTotal)), o.delivery_fee != null ? toGrosz(o.delivery_fee) : 0]);
      if (itemsTotal !== total) issue("ORDER_TOTAL_MISMATCH", o.id, `${fromGrosz(itemsTotal)} vs ${o.total}`);
      for (const i of items) {
        if (i.productId && Number.isSafeInteger(i.quantity) && i.quantity > 0) increment(quantitiesByProduct, i.productId, i.quantity);
        let rate = i.vatRate;
        if (rate == null && i.vatSnapshotPresent) { issue("VAT_SNAPSHOT_UNKNOWN", o.id); continue; }
        if (rate == null) { rate = defaultVatRate; vatAssumed += 1; }
        if (rate == null) { issue("VAT_RATE_MISSING", o.id); continue; }
        vatLines.push({ grossGrosz: toGrosz(i.lineTotal), vatRate: normalizeRate(rate) });
      }
      if (o.delivery_fee != null && toGrosz(o.delivery_fee) > 0) {
        const r = o.delivery_vat_rate ?? (o.deliveryVatSnapshotPresent ? null : defaultVatRate);
        if (r == null) issue("VAT_RATE_MISSING", o.id, "delivery_fee");
        else vatLines.push({ grossGrosz: toGrosz(o.delivery_fee), vatRate: normalizeRate(r) });
      }
    } else issue("ORDER_WITHOUT_ITEMS_FOR_VAT", o.id);
    vatDocuments.push(vatSummary(vatLines));
  }

  // Reembolsos reconocidos en su propia fecha de proceso.
  const paymentById = new Map(payments.map(p=>[p.id,p]));
  const paymentAmount = new Map(payments.map((p) => [p.id, toGrosz(p.amount)]));
  const refundedByPayment = new Map();
  let refundsGrosz = 0, refundCount = 0;
  for (const r of refunds) {
    if (!REFUND_DONE.has(String(r.status))) { if (!["pending", "processing", "failed"].includes(String(r.status))) issue("UNKNOWN_REFUND_STATUS", r.id, r.status); continue; }
    const amt = toGrosz(r.amount);
    const payment = paymentById.get(r.payment_transaction_id);
    if (!r.processed_at) issue("REFUND_TIMESTAMP_MISSING",r.id);
    if (!payment) issue("REFUND_WITHOUT_PAYMENT",r.id);
    if (payment && r.customer_order_id && r.customer_order_id!==payment.customer_order_id) issue("REFUND_ORDER_MISMATCH",r.id);
    if (payment && (payment.currency!=="PLN" || (r.currency!=null && r.currency!==payment.currency))) issue("REFUND_CURRENCY_MISMATCH",r.id);
    if (amt<0){issue("NEGATIVE_REFUND",r.id);continue;}
    refundedByPayment.set(r.payment_transaction_id, sum([refundedByPayment.get(r.payment_transaction_id) ?? 0, amt]));
    if (r.processed_at && localDate(r.processed_at, timeZone) === date) {
      refundsGrosz = sum([refundsGrosz, amt]); refundCount += 1;
      if (!Array.isArray(r.vatLines)) issue("REFUND_VAT_ALLOCATION_REQUIRED", r.id);
      else {
        const summary = vatSummary(r.vatLines);
        if (summary.gross !== amt) issue("REFUND_VAT_AMOUNT_MISMATCH", r.id);
        else refundVatDocuments.push(summary);
      }
    }
  }
  for (const [pid, amt] of refundedByPayment) {
    if (paymentAmount.has(pid) && amt > paymentAmount.get(pid)) issue("REFUND_EXCEEDS_PAYMENT", pid, `${fromGrosz(amt)} > ${fromGrosz(paymentAmount.get(pid))}`);
  }

  // Comisiones y reparto del día (solo asignaciones de pedidos vendidos ese día).
  const dayOrderIds = soldOrderIds;
  const dayAllocs = allocations.filter((a) => dayOrderIds.has(a.customer_order_id));
  const split = {
    platformGrosz: sum(dayAllocs, (a) => toGrosz(a.platform_amount)),
    restaurantNetGrosz: sum(dayAllocs, (a) => toGrosz(a.restaurant_net_amount)),
    courierNetGrosz: sum(dayAllocs, (a) => toGrosz(a.courier_net_amount)),
  };

  function sumDocuments(documents) {
    const total = { byRate: {}, gross: 0, net: 0, vat: 0 };
    for (const document of documents) {
      for (const field of ["gross", "net", "vat"]) increment(total, field, document[field]);
      for (const [rate, part] of Object.entries(document.byRate)) {
        total.byRate[rate] ??= { gross: 0, net: 0, vat: 0 };
        for (const field of ["gross", "net", "vat"]) increment(total.byRate[rate], field, part[field]);
      }
    }
    return total;
  }
  const vat = sumDocuments(vatDocuments);
  const refundVat = sumDocuments(refundVatDocuments);
  const vatAfterRefunds = { gross: sum([vat.gross,-refundVat.gross]), net: sum([vat.net,-refundVat.net]), vat: sum([vat.vat,-refundVat.vat]) };
  const body = {
    date, timeZone, currency: "PLN",
    orders: totals.orders, grossGrosz: totals.grossGrosz,
    refundsGrosz, refundCount, netAfterRefundsGrosz: sum([totals.grossGrosz, -refundsGrosz]),
    valid: issues.length === 0, quantitiesByProduct,
    byPaymentMethod: totals.byPaymentMethod, byChannel: totals.byChannel,
    vat, refundVat, vatAfterRefunds, vatAssumedLines: vatAssumed, split, issues,
  };
  return { ...body, checksum: createHash("sha256").update(canonicalJson(body)).digest("hex") };
}
