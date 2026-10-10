/** Dinero exacto en grosze (enteros). numeric(12,2) de Postgres -> entero sin pasar por floats. */
export class AccountingError extends Error {
  constructor(code, message) { super(message); this.name = "AccountingError"; this.code = code; }
}
export function toGrosz(value) {
  if (typeof value === "number" && Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw new AccountingError("INVALID_MONEY", "More than two decimal places");
  const s = typeof value === "number" ? (Number.isFinite(value) ? value.toFixed(2) : "") : String(value ?? "").trim();
  const m = /^(-?)(\d{1,12})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new AccountingError("INVALID_MONEY", `Invalid amount: ${String(value).slice(0, 30)}`);
  const n = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || 0);
  if (!Number.isSafeInteger(n)) throw new AccountingError("MONEY_OVERFLOW", "Amount exceeds safe range");
  return m[1] ? -n : n;
}
export const fromGrosz = (g) => `${g < 0 ? "-" : ""}${Math.floor(Math.abs(g) / 100)}.${String(Math.abs(g) % 100).padStart(2, "0")}`;
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => { const n = a + f(x); if (!Number.isSafeInteger(n)) throw new AccountingError("MONEY_OVERFLOW", "Unsafe total"); return n; }, 0);
