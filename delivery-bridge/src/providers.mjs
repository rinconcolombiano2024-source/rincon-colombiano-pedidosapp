/** Canonical identifiers match GitHub readiness and SQL contracts. */
const aliases = Object.freeze({ ubereats: "uber_eats", boltfood: "bolt_food" });
const supported = new Set(["uber_eats", "wolt", "glovo", "bolt_food", "pyszne"]);
export function normalizeProvider(value) {
  // Provider identifiers come from external payloads. Never coerce an object,
  // execute a custom toString(), or consult the prototype chain for aliases.
  if (typeof value !== "string") {
    throw Object.assign(new Error("UNSUPPORTED_PROVIDER"), { code: "UNSUPPORTED_PROVIDER" });
  }
  const id = Object.hasOwn(aliases, value) ? aliases[value] : value;
  if (!supported.has(id)) {
    throw Object.assign(new Error("UNSUPPORTED_PROVIDER"), { code: "UNSUPPORTED_PROVIDER" });
  }
  return id;
}
