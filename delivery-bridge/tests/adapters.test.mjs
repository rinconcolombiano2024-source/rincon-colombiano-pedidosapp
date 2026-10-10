import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createPreparedDeliveryRegistry } from "../src/adapter-registry.mjs";
import { toGrosz, verifyWith } from "../src/canonical.mjs";

// IMPORTANTE: los payloads de este archivo son EJEMPLOS SUPUESTOS (provisional).
// Sustitúyelos por payloads reales del sandbox de cada plataforma antes de producción.

const SECRET = "s".repeat(40);
const reg = createPreparedDeliveryRegistry();
const sign = (body, secret = SECRET) => createHmac("sha256", secret).update(body).digest("hex");

test("toGrosz: enteros, decimales exactos y rechazo de floats/negativos", () => {
  assert.equal(toGrosz(1999), 1999);
  assert.equal(toGrosz("19.99", { unit: "major" }), 1999);
  assert.equal(toGrosz(0.1 + 0.2, { unit: "major" }), 30);
  assert.throws(() => toGrosz(19.99), { code: "INVALID_MONEY" });
  assert.throws(() => toGrosz(-1), { code: "INVALID_MONEY" });
  assert.throws(() => toGrosz(NaN), { code: "INVALID_MONEY" });
});

test("verifyWith: HMAC válido, alterado, sin secreto corto y con tolerancia de tiempo", () => {
  const scheme = { type: "hmac-sha256", header: "x-sig", encoding: "hex" };
  const body = '{"a":1}';
  assert.equal(verifyWith(scheme, { headers: { "x-sig": sign(body) }, rawBody: body }, SECRET), true);
  assert.equal(verifyWith(scheme, { headers: { "x-sig": sign(body) }, rawBody: '{"a":2}' }, SECRET), false);
  assert.equal(verifyWith(scheme, { headers: { "x-sig": sign(body) }, rawBody: body }, "corto"), false);
  assert.equal(verifyWith(scheme, { headers: { "x-sig": "zz" }, rawBody: body }, SECRET), false);
  const ts = { ...scheme, timestampHeader: "x-ts", toleranceSeconds: 300 };
  const now = 1_800_000_000_000, t = String(Math.floor(now / 1000));
  const good = createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
  assert.equal(verifyWith(ts, { headers: { "x-sig": good, "x-ts": t }, rawBody: body, now }, SECRET), true);
  assert.equal(verifyWith(ts, { headers: { "x-sig": good, "x-ts": t }, rawBody: body, now: now + 10 * 60_000 }, SECRET), false);
});

test("Wolt: verifica, normaliza a grosze y construye acciones salientes", () => {
  const a = reg.create("wolt", { webhookSecret: SECRET, apiKey: "k".repeat(20) });
  const body = JSON.stringify({ id: "evt-1", order: { id: "w-100", status: "CREATED", price: { amount: 4590, currency: "PLN" },
    consumer: { name: "Ana", phone_number: "+48500111222" }, consumer_comment: "sin cebolla",
    items: [{ id: "i1", name: "Bandeja paisa", count: 2, base_price: 2000, options: [{ id: "o1", name: "Huevo extra", price: 295 }] }] } });
  assert.equal(a.verify({ headers: { "x-wolt-signature": sign(body) }, rawBody: body }), true);
  assert.equal(a.verify({ headers: { "x-wolt-signature": sign(body, "x".repeat(40)) }, rawBody: body }), false);
  const e = a.normalize(body);
  assert.equal(e.totalGrosz, 4590);
  assert.equal(e.eventType, "order_created");
  assert.equal(e.items[0].quantity, 2);
  assert.equal(e.items[0].options[0].unitPriceGrosz, 295);
  const req = a.buildOutbound("accept", { orderId: "w-100" });
  assert.equal(req.method, "PUT");
  assert.match(req.url, /\/orders\/w-100\/accept$/);
  assert.throws(() => a.buildOutbound("explode", { orderId: "w-100" }), { code: "UNSUPPORTED_ACTION" });
});

test("Moneda distinta de PLN se rechaza", () => {
  const a = reg.create("wolt", { webhookSecret: SECRET });
  const body = JSON.stringify({ id: "e", order: { id: "w1", status: "CREATED", price: { amount: 100, currency: "EUR" }, items: [] } });
  assert.throws(() => a.normalize(body), { code: "UNSUPPORTED_CURRENCY" });
});

test("Glovo: token estático en tiempo constante y normalización", () => {
  const a = reg.create("glovo", { webhookSecret: SECRET, apiToken: "t".repeat(20), storeId: "st1" });
  assert.equal(a.verify({ headers: { authorization: SECRET }, rawBody: "{}" }), true);
  assert.equal(a.verify({ headers: { authorization: SECRET + "x" }, rawBody: "{}" }), false);
  const body = JSON.stringify({ order_id: "g-7", currency: "PLN", estimated_total_price: 3200, order_time: "2026-10-09T12:00:00Z",
    customer: { name: "Luis", phone_number: "+48600" }, products: [{ id: "p1", name: "Arepa", quantity: 3, price: 1000 }] });
  const e = a.normalize(body);
  assert.equal(e.orderId, "g-7");
  assert.equal(e.totalGrosz, 3200);
  assert.equal(a.normalize(body, { cancelled: true }).eventType, "order_cancelled");
  assert.match(a.buildOutbound("ready", { orderId: "g-7" }).url, /stores\/st1\/orders\/g-7\/ready_for_pickup$/);
});

test("Uber Eats: notificación pide obtener detalle (needsFetch) y exige https", () => {
  const a = reg.create("ubereats", { clientSecret: SECRET, accessToken: "a".repeat(20) });
  const body = JSON.stringify({ event_id: "u-evt", event_type: "orders.notification", meta: { resource_id: "u-9", status: "pos" },
    resource_href: "https://api.uber.com/v2/eats/order/u-9" });
  assert.equal(a.verify({ headers: { "x-uber-signature": sign(body) }, rawBody: body }), true);
  const e = a.normalize(body);
  assert.equal(e.needsFetch, true);
  assert.equal(e.fetchHref, "https://api.uber.com/v2/eats/order/u-9");
  const bad = a.normalize(body.replace("https://", "http://"));
  assert.equal(bad.fetchHref, null);
  assert.equal(a.normalize(JSON.stringify({ event_id: "c", event_type: "orders.cancel", meta: { resource_id: "u-9" } })).eventType, "order_cancelled");
});

test("Pyszne/Bolt: fallan cerrado sin mapping oficial y funcionan con mapping", () => {
  const closed = reg.create("pyszne", { webhookSecret: SECRET });
  assert.throws(() => closed.normalize("{}"), { code: "NOT_CONFIGURED" });
  assert.throws(() => closed.verify({ headers: {}, rawBody: "{}" }), { code: "NOT_CONFIGURED" });

  const a = reg.create("boltfood", {
    webhookSecret: SECRET,
    verification: { type: "hmac-sha256", header: "x-bolt-signature", encoding: "hex" },
    mapping: { currency: "currency", orderId: "order.id", eventId: "event.id", eventType: "event.type",
      eventTypes: { new: "order_created", cancel: "order_cancelled" }, status: "order.state",
      total: "order.total", moneyUnit: "major", items: { path: "order.lines", id: "sku", name: "title", quantity: "qty", price: "price" } },
  });
  const body = JSON.stringify({ currency: "PLN", event: { id: "b1", type: "new" }, order: { id: "B-5", state: "NEW", total: "25.50",
    lines: [{ sku: "s1", title: "Empanada", qty: 5, price: "5.10" }] } });
  assert.equal(a.verify({ headers: { "x-bolt-signature": sign(body) }, rawBody: body }), true);
  const e = a.normalize(body);
  assert.equal(e.totalGrosz, 2550);
  assert.equal(e.items[0].unitPriceGrosz, 510);
  assert.equal(e.eventType, "order_created");
});

test("Entradas hostiles: JSON inválido, cuerpo enorme y cantidades absurdas", () => {
  const a = reg.create("glovo", { webhookSecret: SECRET });
  assert.throws(() => a.normalize("no-json"), { code: "INVALID_JSON" });
  assert.throws(() => a.normalize("x".repeat(300_000)), { code: "INVALID_BODY" });
  const body = JSON.stringify({ order_id: "g", currency: "PLN", estimated_total_price: 1, products: [{ id: "1", name: "x", quantity: 100000, price: 1 }] });
  assert.throws(() => a.normalize(body), { code: "INVALID_FIELD" });
});

test('V5: missing order identifiers and malformed signature suffix fail closed',()=>{
 const a=reg.create('wolt',{webhookSecret:SECRET});
 assert.throws(()=>a.normalize(JSON.stringify({id:'event',order:{status:'CREATED',price:{amount:100,currency:'PLN'},items:[]}})),{code:'INVALID_FIELD'});
 const body='{"a":1}';
 assert.equal(verifyWith({type:'hmac-sha256',header:'x-sig'}, {headers:{'x-sig':sign(body)+'zz'},rawBody:body},SECRET),false);
 assert.throws(()=>toGrosz(Number.MAX_SAFE_INTEGER+1),{code:'INVALID_MONEY'});
});
