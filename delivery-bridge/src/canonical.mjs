/**
 * Formato canónico de eventos de reparto + utilidades comunes.
 * Dinero SIEMPRE en grosze (enteros). Nunca floats.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { DeliveryAdapterError } from "./adapter-registry.mjs";

export const EVENT_TYPES = Object.freeze(["order_created", "order_updated", "order_cancelled", "order_status"]);
export const FULFILLMENT = Object.freeze(["delivery", "pickup"]);

export function toGrosz(value, { unit = "minor" } = {}) {
  if (!["minor", "major"].includes(unit)) throw new DeliveryAdapterError("INVALID_MONEY", "Unknown monetary unit");
  if (typeof value === "string") {
    const match = /^(\d{1,16})(?:\.(\d{1,2}))?$/.exec(value.trim());
    if (!match) throw new DeliveryAdapterError("INVALID_MONEY", "Invalid decimal amount");
    const fraction = (match[2] ?? "").padEnd(2, "0");
    if (unit === "minor" && fraction !== "00") throw new DeliveryAdapterError("INVALID_MONEY", "Minor units must be integer");
    const exact = BigInt(match[1]) * (unit === "major" ? 100n : 1n) + (unit === "major" ? BigInt(fraction) : 0n);
    if (exact > BigInt(Number.MAX_SAFE_INTEGER)) throw new DeliveryAdapterError("INVALID_MONEY", "Amount exceeds safe range");
    return Number(exact);
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new DeliveryAdapterError("INVALID_MONEY", "Invalid monetary amount");
  const scaled = unit === "major" ? value * 100 : value;
  const result = Math.round(scaled);
  if (!Number.isSafeInteger(result) || (unit === "minor" ? result !== scaled : Math.abs(scaled - result) > 0.000001))
    throw new DeliveryAdapterError("INVALID_MONEY", "Amount requires unsafe rounding or exceeds safe range");
  return result;
}

export function pick(obj, path) {
  return String(path).split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

export function requireString(value, name, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new DeliveryAdapterError("INVALID_FIELD", `Invalid field: ${name}`);
  }
  return value.trim();
}

function identifier(value, name) {
  if (value === undefined || value === null) throw new DeliveryAdapterError("INVALID_FIELD", `Missing ${name}`);
  return requireString(String(value), name);
}
export function buildEvent(provider, f) {
  if (!EVENT_TYPES.includes(f.eventType)) throw new DeliveryAdapterError("INVALID_EVENT_TYPE", "Unknown event type");
  const items = (f.items ?? []).map((it) => ({
    externalId: identifier(it.externalId, "item.externalId"),
    name: requireString(it.name, "item.name", 200),
    quantity: Number.isInteger(it.quantity) && it.quantity > 0 && it.quantity <= 999 ? it.quantity
      : (() => { throw new DeliveryAdapterError("INVALID_FIELD", "Invalid quantity"); })(),
    unitPriceGrosz: it.unitPriceGrosz,
    options: (it.options ?? []).map((o) => ({ externalId: String(o.externalId), name: String(o.name).slice(0, 200), unitPriceGrosz: o.unitPriceGrosz ?? 0, quantity: o.quantity ?? 1 })),
  }));
  return Object.freeze({
    provider,
    orderId: identifier(f.orderId, "orderId"),
    eventId: identifier(f.eventId, "eventId"),
    eventType: f.eventType,
    status: requireString(String(f.status ?? f.eventType), "status", 80),
    currency: "PLN",
    totalGrosz: f.totalGrosz ?? null,
    deliveryFeeGrosz: f.deliveryFeeGrosz ?? 0,
    fulfillment: FULFILLMENT.includes(f.fulfillment) ? f.fulfillment : "delivery",
    placedAt: f.placedAt ?? null,
    customer: f.customer ? { name: String(f.customer.name ?? "").slice(0, 120), phone: String(f.customer.phone ?? "").slice(0, 40) } : null,
    notes: f.notes ? String(f.notes).slice(0, 500) : null,
    items,
    needsFetch: Boolean(f.needsFetch),
    fetchHref: f.fetchHref ?? null,
  });
}

export function cleanCurrency(code, expected = "PLN") {
  if (code !== undefined && code !== null && String(code).toUpperCase() !== expected) {
    throw new DeliveryAdapterError("UNSUPPORTED_CURRENCY", "Only PLN orders are supported");
  }
}

function toBuf(str, encoding) {
  return encoding === "base64" ? Buffer.from(str, "base64") : Buffer.from(str, "hex");
}

/** Verificación genérica: HMAC-SHA256 o token estático, ambos en tiempo constante. */
export function verifyWith(scheme, { headers, rawBody, now = Date.now() }, secret) {
  if (!secret || String(secret).length < 16) return false;
  const h = (name) => {
    if (typeof name !== "string" || !headers) return null;
    try {
      if (typeof headers.get === "function") return headers.get(name);
      if (typeof headers !== "object" || Array.isArray(headers)) return null;
      const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
      return key && typeof headers[key] === "string" ? headers[key] : null;
    } catch {
      return null;
    }
  };
  if (scheme.type === "static-token") {
    const got = h(scheme.header);
    if (typeof got !== "string") return false;
    const expected = (scheme.prefix ?? "") + secret;
    const a = Buffer.from(got), b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  if (scheme.type === "hmac-sha256") {
    let sig = h(scheme.header);
    if (typeof sig !== "string") return false;
    if (scheme.prefix && sig.startsWith(scheme.prefix)) sig = sig.slice(scheme.prefix.length);
    // Webhook signatures must cover the exact original HTTP bytes. Stringifying
    // a Uint8Array produces comma-separated numbers and invalidates signed data.
    const body = typeof rawBody === "string"
      ? Buffer.from(rawBody, "utf8")
      : rawBody instanceof Uint8Array ? Buffer.from(rawBody) : null;
    if (!body) return false;
    let signed = body;
    if (scheme.timestampHeader) {
      const ts = h(scheme.timestampHeader);
      if (!/^\d{10}$/.test(String(ts))) return false;
      if (Math.abs(Math.floor(now / 1000) - Number(ts)) > (scheme.toleranceSeconds ?? 300)) return false;
      signed = Buffer.concat([Buffer.from(`${ts}.`, "utf8"), body]);
    }
    const expected = createHmac("sha256", secret).update(signed).digest();
    const encoding = scheme.encoding ?? "hex";
    if (encoding === "hex" && !/^[0-9a-f]{64}$/i.test(sig)) return false;
    if (encoding === "base64" && !/^[A-Za-z0-9+/]{43}=$/.test(sig)) return false;
    let got;
    try { got = toBuf(sig, scheme.encoding ?? "hex"); } catch { return false; }
    return got.length === expected.length && timingSafeEqual(got, expected);
  }
  return false;
}

export function parseJson(rawBody, max = 256 * 1024) {
  if (typeof rawBody !== "string" || rawBody.length === 0 || rawBody.length > max) {
    throw new DeliveryAdapterError("INVALID_BODY", "Invalid body");
  }
  try {
    const v = JSON.parse(rawBody);
    if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new DeliveryAdapterError("INVALID_JSON", "Invalid JSON");
  }
}

/**
 * Construct a provider request without allowing credentials to leave the reviewed
 * API origin. Outbound calls are still disabled unless a separate trusted worker
 * has authenticated the merchant, store and provider contract.
 *
 * approvedOrigins is an explicit server-side code allowlist, never webhook input.
 * No DNS, I/O, polling, retries or background CPU work occurs here.
 */
export function requestDescriptor({ method, baseUrl, path, headers = {}, body, approvedOrigins = [] }) {
  let base;
  let destination;
  try {
    base = new URL(baseUrl);
    destination = new URL(path, base);
  } catch {
    throw new DeliveryAdapterError("UNAPPROVED_DESTINATION", "Invalid partner API URL");
  }
  if (
    base.protocol !== "https:" ||
    base.username || base.password || base.search || base.hash ||
    (base.port && base.port !== "443") ||
    destination.origin !== base.origin ||
    destination.username || destination.password ||
    destination.hash || destination.search ||
    !Array.isArray(approvedOrigins) ||
    !approvedOrigins.includes(base.origin)
  ) {
    throw new DeliveryAdapterError("UNAPPROVED_DESTINATION", "Partner API origin is not explicitly approved");
  }
  return Object.freeze({
    method,
    url: destination.toString(),
    headers: Object.freeze({ "content-type": "application/json", ...headers }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
