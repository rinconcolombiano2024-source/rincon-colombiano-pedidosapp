import test from "node:test";
import assert from "node:assert/strict";
import { DeliveryOutbox, MemoryOutboxStore } from "../src/outbox.mjs";
import { createPreparedDeliveryRegistry } from "../src/adapter-registry.mjs";

const registry = createPreparedDeliveryRegistry();
const opts = { wolt: { apiKey: "k".repeat(20), webhookSecret: "s".repeat(32) } };
function harness(responder, extra = {}) {
  let t = 1_000_000; const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, method: init.method, key: init.headers["idempotency-key"] }); const r = await responder(calls.length, url); if (r instanceof Error) throw r; return { ok: r < 300, status: r }; };
  const box = new DeliveryOutbox({ registry, simulationOnly: true, providerOptions: opts, fetchImpl, now: () => t, random: () => 0.5, ...extra });
  return { box, calls, advance: (ms) => { t += ms; }, store: box };
}

test("encolar es idempotente: mismo (plataforma, pedido, acción) no duplica", async () => {
  const { box } = harness(async () => 200);
  const a = await box.enqueue({ provider: "wolt", orderId: "w1", action: "accept" });
  const b = await box.enqueue({ provider: "wolt", orderId: "w1", action: "accept" });
  assert.equal(a.id, b.id); assert.equal(b.duplicate, true);
});

test("envío correcto una sola vez, con cabecera de idempotencia", async () => {
  const { box, calls } = harness(async () => 200);
  await box.enqueue({ provider: "wolt", orderId: "w1", action: "accept" });
  assert.equal((await box.tick()).sent, 1); assert.equal((await box.tick()).sent, 0);
  assert.equal(calls.length, 1); assert.match(calls[0].url, /orders\/w1\/accept$/); assert.equal(calls[0].key.length, 32);
});

test("reintenta 5xx seguros en simulación con backoff y acaba enviando", async () => {
  const { box, calls, advance } = harness(async (n) => (n === 1 ? 503 : n === 2 ? 503 : 200));
  await box.enqueue({ provider: "wolt", orderId: "w1", action: "accept" });
  assert.equal((await box.tick()).retried, 1); assert.equal((await box.tick()).sent, 0);
  assert.equal(calls.length, 1); assert.equal((await box.pending())[0].state, 'pending'); // aún en espera, excluida por la consulta acotada
  advance(30_000); assert.equal((await box.tick()).retried, 1);
  advance(30_000); assert.equal((await box.tick()).sent, 1); assert.equal(calls.length, 3);
});

test("4xx es definitivo (dead) y no se reintenta; 409 requiere conciliación", async () => {
  let h = harness(async () => 400);
  await h.box.enqueue({ provider: "wolt", orderId: "w1", action: "accept" });
  assert.equal((await h.box.tick()).dead, 1); h.advance(500_000); assert.equal((await h.box.tick()).sent, 0); assert.equal(h.calls.length, 1);
  h = harness(async () => 409);
  await h.box.enqueue({ provider: "wolt", orderId: "w2", action: "accept" });
  assert.equal((await h.box.tick()).unknown, 1);
});

test("'ready' espera a que 'accept' esté enviado; se respeta el orden", async () => {
  const { box, calls, advance } = harness(async (n) => (n === 1 ? 503 : 200));
  await box.enqueue({ provider: "wolt", orderId: "w1", action: "ready" });
  await box.enqueue({ provider: "wolt", orderId: "w1", action: "accept" });
  await box.tick(); assert.match(calls[0].url, /accept/); assert.equal(calls.length, 1); // accept falló; ready no se envió
  advance(200_000); await box.tick(); advance(1); await box.tick();
  assert.deepEqual(calls.map((c) => c.url.split("/").pop()), ["accept", "accept", "ready"]);
});

test("plazo vencido => expired (no se envía tarde)", async () => {
  const { box, calls, advance } = harness(async () => 200);
  await box.enqueue({ provider: "wolt", orderId: "w1", action: "accept" });
  advance(10 * 60_000);
  assert.equal((await box.tick()).expired, 1); assert.equal(calls.length, 0);
  assert.equal((await box.pending())[0].state, "expired");
});

test("máximo de intentos => dead; disyuntor pausa la plataforma tras fallos seguidos", async () => {
  const { box, calls, advance } = harness(async () => 503, { maxAttempts: 3, breakerThreshold: 2, breakerPauseMs: 60_000, deadlineMs: { accept: 1e9, ready: 1e9, delivered: 1e9, cancel: 1e9, reject: 1e9 } });
  await box.enqueue({ provider: "wolt", orderId: "w1", action: "accept" });
  await box.enqueue({ provider: "wolt", orderId: "w2", action: "accept" });
  await box.tick(); // dos intentos fallidos -> el disyuntor se abre
  advance(10_000); const s = await box.tick(); assert.equal(s.sent, 0); assert.equal(calls.length, 2);
  assert.ok((await box.pending()).every(e=>e.state==='pending')); // el disyuntor excluye el proveedor antes de cargar filas
  for (let i = 0; i < 6; i++) { advance(200_000); await box.tick(); }
  assert.ok((await box.pending()).every((e) => e.state === "dead"));
});

test("proveedor sin credenciales falla cerrado (dead, sin llamar a la red)", async () => {
  const { box, calls } = harness(async () => 200);
  await box.enqueue({ provider: "pyszne", orderId: "p1", action: "accept" });
  assert.equal((await box.tick()).dead, 1); assert.equal(calls.length, 0);
});
