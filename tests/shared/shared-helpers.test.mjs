import test from "node:test";
import assert from "node:assert/strict";
import { safeEqual } from "../../supabase/functions/_shared/safe-equal.ts";
import { withCors, allowedOrigins } from "../../supabase/functions/_shared/cors.ts";

test("safeEqual: iguales, distintos y longitudes distintas", () => {
  assert.equal(safeEqual("abc123", "abc123"), true);
  assert.equal(safeEqual("abc123", "abc124"), false);
  assert.equal(safeEqual("abc", "abc123"), false);
  assert.equal(safeEqual("", ""), true);
});

const env = (m = {}) => (k) => m[k];
const handler = () => new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "x-a": "1" } });

test("withCors: origen permitido se refleja", async () => {
  const h = withCors(handler, env());
  const r = await h(new Request("https://f/x", { headers: { origin: "https://rincon-colombiano-pedidosapp.vercel.app" } }));
  assert.equal(r.headers.get("access-control-allow-origin"), "https://rincon-colombiano-pedidosapp.vercel.app");
  assert.equal(r.headers.get("x-a"), "1");
  assert.equal(await r.text(), "ok");
});

test("withCors: origen no permitido bloquea la operación", async () => {
  const h = withCors(handler, env());
  const r = await h(new Request("https://f/x", { headers: { origin: "https://evil.example" } }));
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  assert.equal(r.status, 403);
});

test("withCors: preflight de origen no permitido da 403", async () => {
  const h = withCors(handler, env());
  const r = await h(new Request("https://f/x", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
  assert.equal(r.status, 403);
});

test("withCors: sin Origin (servidor a servidor) pasa sin ACAO", async () => {
  const h = withCors(handler, env());
  const r = await h(new Request("https://f/x"));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), null);
});

test("allowedOrigins: RC_ALLOWED_ORIGINS extiende la lista y el Android (Capacitor) está incluido", () => {
  const s = allowedOrigins(env({ RC_ALLOWED_ORIGINS: "https://rincon.pl/, https://app.rincon.pl" }));
  assert.ok(s.has("https://rincon.pl") && s.has("https://app.rincon.pl") && s.has("https://localhost"));
});
