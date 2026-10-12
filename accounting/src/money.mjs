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
export function fromGrosz(g) {
  if (!Number.isSafeInteger(g)) throw new AccountingError("INVALID_MONEY", "Minor units must be a safe integer");
  const units = BigInt(g), absolute = units < 0n ? -units : units;
  return `${units < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => { const n = a + f(x); if (!Number.isSafeInteger(n)) throw new AccountingError("MONEY_OVERFLOW", "Unsafe total"); return n; }, 0);
