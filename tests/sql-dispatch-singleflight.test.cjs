const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8").replace(/\r\n/g, "\n");
const migration = read("MIGRACION-V91-04-CONTROL-CARGA-SINCRONIZACION.sql");
const patch = read("PATCH-CPU-DISPATCH-SINGLEFLIGHT.sql");
const signature = "create or replace function public.rc_ordera_process_delivery_queue(p_limit integer default 20)";
const guard = [
  "  -- Evita lotes simultaneos sin esperar ni modificar pedidos si esta ocupado.",
  "  if not pg_catalog.pg_try_advisory_xact_lock(9104, 8301) then",
  "    return 0;",
  "  end if;",
  "",
  "",
].join("\n");
function definition(sql) {
  const start = sql.indexOf(signature);
  assert.ok(start >= 0, "firma original conservada");
  const end = sql.indexOf("\n$$;", start);
  assert.ok(end > start);
  return sql.slice(start, end + 4);
}
function body(sql) {
  const fn = definition(sql);
  return fn.slice(fn.indexOf("as $$\n") + 6, fn.lastIndexOf("\n$$;"));
}
const hash = value => createHash("md5").update(value.trim().replace(/\s+/g, " ")).digest("hex");

// Comprobaciones estructurales: no sustituyen ejecutar PostgreSQL ni medir CPU.
test("SQL: parche y migracion contienen exactamente la misma funcion", () => {
  assert.equal(definition(patch), definition(migration));
});
test("SQL: unica alteracion del cuerpo es la proteccion no bloqueante", () => {
  const current = body(migration);
  assert.equal(current.split(guard).length, 2);
  assert.equal(hash(current.replace(guard, "")), "377a2fcb7d4a0b8c34575889c3f4a0fb");
  assert.ok(current.indexOf(guard) < current.indexOf("for v_item in"));
  assert.ok(current.includes("for update of co skip locked"));
});
test("SQL: preflight acepta solo la base conocida o el parche ya aplicado", () => {
  const preflight = patch.slice(0, patch.indexOf(signature));
  assert.match(preflight, /v_body is null then\s+raise exception/);
  const allowed = [...preflight.matchAll(/'([0-9a-f]{32})'/g)].map(match => match[1]);
  assert.deepEqual(allowed, ["377a2fcb7d4a0b8c34575889c3f4a0fb", hash(body(patch))]);
  assert.match(preflight, /if v_hash not in \([\s\S]*?\) then\s+raise exception/);
  assert.match(preflight, /pg_catalog\.btrim\(pg_catalog\.regexp_replace\(v_body, '\\s\+', ' ', 'g'\)\)/);
});
test("SQL: parche transaccional no cambia cron ni permisos ni dispara el dispatch", () => {
  const sql = patch.replace(/--[^\n]*/g, "");
  assert.match(sql, /^\s*begin;/);
  assert.match(sql, /commit;\s*$/);
  assert.doesNotMatch(sql, /\b(?:revoke|grant|cron\.|create\s+index|alter\s+table|pg_advisory_lock)\b/i);
  const outsideFunction = sql.replace(definition(sql), "");
  assert.doesNotMatch(outsideFunction, /(?:select|perform)\s+public\.rc_ordera_process_delivery_queue\s*\(/i);
});
