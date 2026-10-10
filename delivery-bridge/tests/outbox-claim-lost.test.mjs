import test from "node:test";
import assert from "node:assert/strict";
import { DeliveryOutbox, MemoryOutboxStore } from "../src/outbox.mjs";
import { createPreparedDeliveryRegistry } from "../src/adapter-registry.mjs";

const registry = createPreparedDeliveryRegistry();
const opts = { wolt: { apiKey: "k".repeat(20), webhookSecret: "s".repeat(32) } };

test("CLAIM_LOST en una operación no aborta el lote: las demás se procesan y se cuenta como 'lost'", async () => {
  const inner = new MemoryOutboxStore();
  let failOnce = true;
  const store = new Proxy(inner, { get(t, k) {
    if (k === "finish") return async (e, token) => { if (failOnce) { failOnce = false; throw new Error("CLAIM_LOST"); } return t.finish(e, token); };
    const v = t[k]; return typeof v === "function" ? v.bind(t) : v; } });
  const calls = [];
  const box = new DeliveryOutbox({ store, registry, simulationOnly: true, providerOptions: opts,
    fetchImpl: async (url) => { calls.push(url); return { ok: true, status: 200 }; } });
  for (const id of ["w1", "w2", "w3"]) await box.enqueue({ provider: "wolt", orderId: id, action: "accept" });
  const stats = await box.tick();
  assert.equal(stats.lost, 1);
  assert.equal(stats.sent, 2);          // las otras dos sí se enviaron y registraron
  assert.equal(calls.length, 3);        // la perdida SÍ se envió una vez (la reclamación era suya al enviar)
  const again = await box.tick();       // la perdida queda 'processing' hasta que recover() la pase a 'unknown': nunca se reenvía sola
  assert.equal(calls.length, 3);
  assert.equal(again.sent, 0);
});

test("un error de almacén distinto de CLAIM_LOST sí se propaga (no se silencia)", async () => {
  const inner = new MemoryOutboxStore();
  const store = new Proxy(inner, { get(t, k) { if (k === "finish") return async () => { throw new Error("DB_DOWN"); }; const v = t[k]; return typeof v === "function" ? v.bind(t) : v; } });
  const box = new DeliveryOutbox({ store, registry, simulationOnly: true, providerOptions: opts, fetchImpl: async () => ({ ok: true, status: 200 }) });
  await box.enqueue({ provider: "wolt", orderId: "w1", action: "accept" });
  await assert.rejects(() => box.tick(), /DB_DOWN/);
});
