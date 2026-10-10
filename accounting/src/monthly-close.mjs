import { createHash } from "node:crypto";
import { AccountingError, sum } from "./money.mjs";
import { canonicalJson } from "./daily-close.mjs";
import { RATES } from "./vat.mjs";

export function buildMonthlyClose(days, month) {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month ?? "")) throw new AccountingError("INVALID_MONTH", "month must be YYYY-MM");
  const inMonth = days.filter((d) => d.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  const [y, m] = month.split("-").map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const have = new Set(inMonth.map((d) => d.date));
  const missingDays = [];
  for (let d = 1; d <= dim; d++) { const k = `${month}-${String(d).padStart(2, "0")}`; if (!have.has(k)) missingDays.push(k); }
  if (have.size !== inMonth.length) throw new AccountingError("DUPLICATE_DAY", "Duplicate daily close");

  const t = { orders: 0, grossGrosz: 0, refundsGrosz: 0, platformGrosz: 0, restaurantNetGrosz: 0, courierNetGrosz: 0 };
  const vat = Object.fromEntries(RATES.map((r) => [r, { gross: 0, net: 0, vat: 0 }]));
  const issues = [];
  const refundVat = {gross:0,net:0,vat:0};
  for (const d of inMonth) {
    for (const key of ["gross","net","vat"]) refundVat[key] = sum([refundVat[key], d.refundVat?.[key] ?? 0]);
    t.orders = sum([t.orders,d.orders]); t.grossGrosz = sum([t.grossGrosz,d.grossGrosz]); t.refundsGrosz = sum([t.refundsGrosz,d.refundsGrosz]);
    t.platformGrosz = sum([t.platformGrosz,d.split.platformGrosz]); t.restaurantNetGrosz = sum([t.restaurantNetGrosz,d.split.restaurantNetGrosz]); t.courierNetGrosz = sum([t.courierNetGrosz,d.split.courierNetGrosz]);
    for (const [r, v] of Object.entries(d.vat.byRate)) { if(!Object.hasOwn(vat,r))throw new AccountingError("UNKNOWN_VAT_RATE","Unknown daily VAT category");
      for(const k of ["gross","net","vat"])vat[r][k]=sum([vat[r][k],v[k]]); }
    for (const i of d.issues) issues.push({ date: d.date, ...i });
  }
  const body = { month, days: inMonth.length, missingDays, ...t, netAfterRefundsGrosz: sum([t.grossGrosz, -t.refundsGrosz]), vatByRate: vat, refundVat, vatAfterRefunds: {gross: sum([sum(Object.values(vat),v=>v.gross),-refundVat.gross]), net: sum([sum(Object.values(vat),v=>v.net),-refundVat.net]), vat: sum([sum(Object.values(vat),v=>v.vat),-refundVat.vat])}, issuesCount: issues.length, issues };
  return { ...body, sealed: createHash("sha256").update(canonicalJson(body)).digest("hex"), complete: missingDays.length === 0 && issues.length === 0 && inMonth.every(d=>d.valid!==false) };
}
