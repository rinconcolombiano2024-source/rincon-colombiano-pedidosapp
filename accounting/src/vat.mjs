/**
 * Configured gross/net split by rate within a document. Confirm rounding with the accountant and device.
 * Arithmetic groups by rate within a document
 * (no línea a línea), con redondeo half-up a grosz. Tasas: 23, 8, 5, 0 y ZW (exento).
 */
import { AccountingError, sum } from "./money.mjs";

export const RATES = Object.freeze(["23", "8", "5", "0", "ZW", "NP", "NP I", "NP II"]);

export function normalizeRate(rate, verifiedLetterMap = null) {
  const raw = String(rate ?? "").trim().toUpperCase();
  if (verifiedLetterMap && Object.hasOwn(verifiedLetterMap, raw)) return normalizeRate(verifiedLetterMap[raw]);
  if (raw === "ZW" || raw === "EXEMPT") return "ZW";
  if (["NP", "NP I", "NP II"].includes(raw)) return raw;
  const digits = raw.replace(/[^0-9]/g, "");
  if (/^(?:VAT_)?(?:23|8|5|0)$/.test(raw) && RATES.includes(digits)) return digits;
  throw new AccountingError("UNKNOWN_VAT_RATE", `Unknown VAT rate: ${raw.slice(0, 20)}`);
}

export function splitGross(grossGrosz, rate) {
  if (!Number.isSafeInteger(grossGrosz)) throw new AccountingError("INVALID_MONEY", "Gross must be safe integer minor units");
  const r = normalizeRate(rate);
  if (r === "0" || r === "ZW" || r.startsWith("NP")) return { gross: grossGrosz, net: grossGrosz, vat: 0 };
  const sign = grossGrosz < 0 ? -1 : 1;
  const g = Math.abs(grossGrosz), d = 100 + Number(r);
  const net = Number((BigInt(g) * 200n + BigInt(d)) / (2n * BigInt(d))); // round half up de g*100/d
  return { gross: sign * g, net: sign * net, vat: sign * (g - net) };
}

/** lines: [{ grossGrosz, vatRate }] -> { byRate: {rate:{gross,net,vat}}, gross, net, vat } */
export function vatSummary(lines) {
  const acc = {};
  for (const l of lines) {
    const r = normalizeRate(l.vatRate);
    if (!Number.isSafeInteger(l.grossGrosz)) throw new AccountingError("INVALID_MONEY", "Invalid VAT line minor units");
    acc[r] = sum([acc[r] ?? 0, l.grossGrosz]);
  }
  const byRate = {};
  let gross = 0, net = 0, vat = 0;
  for (const r of RATES) {
    if (acc[r] === undefined) continue;
    const s = splitGross(acc[r], r);
    byRate[r] = s; gross = sum([gross, s.gross]); net = sum([net, s.net]); vat = sum([vat, s.vat]);
  }
  return { byRate, gross, net, vat };
}
