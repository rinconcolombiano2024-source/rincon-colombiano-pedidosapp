import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("MIGRACION-V5-20261010-08-TRANSLATION-GLOBAL-CAP.sql", "utf8");
const fn = readFileSync("supabase/functions/translate-public-content/index.ts", "utf8");

test("V5-08: tabla global cerrada a anon/authenticated, función solo para service_role, aditiva", () => {
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.translation_global_limits FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.rc_ordera_consume_translation_quota_v2[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.rc_ordera_consume_translation_quota_v2[\s\S]*TO service_role/);
  assert.match(sql, /SET search_path = pg_catalog, public/);
  assert.doesNotMatch(sql, /DROP (TABLE|FUNCTION)|TRUNCATE/i);                // sin destrucción
  assert.equal((sql.match(/\$\$/g) || []).length % 2, 0);
  assert.equal((sql.match(/\$body\$/g) || []).length, 2);
});
test("V5-08: tope horario ATÓMICO (UPSERT condicionado), tope diario, validación y limpieza acotada", () => {
  assert.match(sql, /ON CONFLICT \(window_start\) DO UPDATE\s+SET request_count = translation_global_limits\.request_count \+ 1\s+WHERE translation_global_limits\.request_count < v_hour_limit/);
  assert.match(sql, /IF v_hour_count IS NULL THEN RETURN 'global_limit'/);
  assert.match(sql, /v_day_total >= v_day_limit/);
  assert.match(sql, /p_client_hash !~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(sql, /LIMIT 200/);                                              // borrado acotado
  assert.match(sql, /least\(greatest\(coalesce\(p_global_hourly_limit/);       // límites con cotas, no controlables por el cliente
});
test("Edge Function: v2 is mandatory; missing migration fails closed without v1 downgrade", () => {
  assert.match(fn, /rc_ordera_consume_translation_quota_v2/);
  assert.match(fn, /PGRST202/);
  assert.doesNotMatch(fn, /admin\.rpc\("rc_ordera_consume_translation_quota"/);
  assert.match(fn, /response\(503, \{ error: "Translation quota migration is required"/);
  assert.match(fn, /"global_limit"\) return response\(429/);
  assert.match(fn, /response\(500, \{ error: "Could not validate translation quota"/);
  assert.ok(fn.indexOf("public_content_translations") < fn.indexOf("rc_ordera_consume_translation_quota_v2"));
});
