#!/usr/bin/env node
/**
 * Prueba de concurrencia/idempotencia contra TU entorno (staging). Dispara K peticiones SIMULTÁNEAS con el
 * MISMO id de pedido, N veces, y exige: todas 2xx, mismo id devuelto, ninguna 5xx.
 *   FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1 ANON_KEY=... RESTAURANT_USER_ID=<uuid> PRODUCT_ID=<id> \
 *   [CUSTOMER_JWT=<jwt>] [ROUNDS=20] [PARALLEL=10] node scripts/concurrency-test.mjs
 * Crea pedidos de PRUEBA reales: úsalo solo en staging. Con --self-test usa un servidor simulado (sin red).
 */
import { randomUUID, randomBytes } from "node:crypto";
import http from "node:http";

export async function runConcurrency({ url, anonKey, jwt, restaurantUserId, productId, rounds = 20, parallel = 10, fetchImpl = fetch, makeBody }) {
  const failures = [];
  const body = makeBody ?? ((id) => ({
    p_id: id, p_user_id: restaurantUserId, p_public_token: randomBytes(16).toString("hex"), p_table_label: "TEST-CONCURRENCIA",
    p_customer_name: "Prueba concurrencia", p_order_type: "Recoger en el punto", p_customer_user_id: null, p_total: 0,
    p_order_json: { paymentMethod: "Pago al recoger", items: [{ product_id: productId, quantity: 1 }] },
  }));
  for (let r = 0; r < rounds; r++) {
    const id = randomUUID(); const token = randomBytes(16).toString("hex");
    const payload = JSON.stringify({ ...body(id), p_public_token: token });
    const res = await Promise.all(Array.from({ length: parallel }, async () => {
      try {
        const x = await fetchImpl(`${url}/create-customer-order`, { method: "POST", headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${jwt || anonKey}` }, body: payload });
        let j = {}; try { j = await x.json(); } catch { /* sin cuerpo */ }
        return { status: x.status, id: j?.id ?? j?.order?.id ?? j?.data?.id ?? null };
      } catch (e) { return { status: 0, id: null }; }
    }));
    const bad = res.filter((x) => x.status < 200 || x.status >= 300);
    if (res.some(x => !x.id || x.id !== id)) failures.push(`ronda ${r}: missing or mismatched returned order id`);
    const ids = new Set(res.filter((x) => x.id).map((x) => x.id));
    if (bad.length) failures.push(`ronda ${r}: ${bad.length}/${parallel} respuestas no-2xx (${[...new Set(bad.map((b) => b.status))].join(",")})`);
    if (ids.size > 1) failures.push(`ronda ${r}: ids distintos devueltos para el mismo pedido (${ids.size})`);
  }
  return { rounds, parallel, failures, ok: failures.length === 0 };
}

if (process.argv[1] && process.argv[1].endsWith("concurrency-test.mjs")) {
  if (process.argv.includes("--self-test")) {
    // Servidor simulado SIN bloqueo (reproduce el defecto) y CON bloqueo (el comportamiento esperado tras V91-70).
    const mk = (locked) => { const seen = new Map(); return http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", async () => {
      const id = JSON.parse(b).p_id; await new Promise((r) => setTimeout(r, Math.random() * 5));
      if (seen.has(id) && locked) { res.writeHead(200); return res.end(JSON.stringify({ id })); }
      if (seen.has(id) && !locked) { res.writeHead(500); return res.end("{}"); }
      seen.set(id, 1); res.writeHead(200); res.end(JSON.stringify({ id })); }); }); };
    for (const [locked, expectOk] of [[false, false], [true, true]]) {
      const s = mk(locked); await new Promise((r) => s.listen(0, "127.0.0.1", r));
      const out = await runConcurrency({ url: `http://127.0.0.1:${s.address().port}`, anonKey: "x", restaurantUserId: "r", productId: "p", rounds: 10, parallel: 8 });
      s.close();
      console.log(`${out.ok === expectOk ? "OK    " : "FALLO "} self-test (${locked ? "con" : "sin"} bloqueo): ${out.ok ? "sin errores" : out.failures.length + " rondas con error"}`);
      if (out.ok !== expectOk) process.exit(1);
    }
    process.exit(0);
  }
  if (process.env.RC_TEST_ENVIRONMENT !== "staging") { console.error("Set RC_TEST_ENVIRONMENT=staging; production probe forbidden"); process.exit(2); }
  const need = ["FUNCTIONS_URL", "ANON_KEY", "RESTAURANT_USER_ID", "PRODUCT_ID"]; const miss = need.filter((k) => !process.env[k]);
  if (miss.length) { console.error(`Faltan variables: ${miss.join(", ")}`); process.exit(2); }
  const out = await runConcurrency({ url: process.env.FUNCTIONS_URL.replace(/\/$/, ""), anonKey: process.env.ANON_KEY, jwt: process.env.CUSTOMER_JWT, restaurantUserId: process.env.RESTAURANT_USER_ID,
    productId: process.env.PRODUCT_ID, rounds: Number(process.env.ROUNDS || 20), parallel: Number(process.env.PARALLEL || 10) });
  console.log(out.ok ? `OK: ${out.rounds} rondas x ${out.parallel} peticiones simultáneas, sin duplicados ni errores` : out.failures.join("\n"));
  process.exit(out.ok ? 0 : 1);
}
