import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const base = readFileSync("MIGRACION-V91-29A-RPC-INTERNO-PEDIDOS.sql", "utf8").replace(/\r\n/g, "\n").replace(/V91-29A/g, "V5-20261010-02").split("\n");
const next = readFileSync("MIGRACION-V5-20261010-02-ORDEN-IDEMPOTENTE-IVA.sql", "utf8").replace(/\r\n/g, "\n").split("\n");

test("V5-20261010-02 solo AÑADE líneas a V91-29A: no elimina ni altera la lógica existente", () => {
  // Cada línea de la base debe aparecer, en el mismo orden, dentro de la nueva (subsecuencia).
  let j = 0;
  for (const line of base) {
    while (j < next.length && next[j] !== line) j++;
    assert.ok(j < next.length, `línea perdida o modificada: ${line.slice(0, 80)}`);
    j++;
  }
});

test("V5-20261010-02 contiene el bloqueo por pedido ANTES de leer el pedido existente", () => {
  const text = next.join("\n");
  const lock = text.indexOf("pg_advisory_xact_lock(pg_catalog.hashtextextended(v_order_id::text");
  const select = text.indexOf("select co.* into v_existing");
  assert.ok(lock > 0 && select > lock);
});

test("V5-20261010-02 congela vat_rate_snapshot y define la normalización de tasas", () => {
  const text = next.join("\n");
  assert.match(text, /'vat_rate_snapshot', coalesce\(/);
  assert.match(text, /create or replace function public\.rc_ordera_normalize_vat_rate/);
  for (const t of ["'23'", "'8'", "'5'", "'0'", "'ZW'"]) assert.ok(text.includes(`then ${t}`));
  assert.equal((text.match(/\$\$/g) || []).length % 2, 0);
  // la RPC sigue cerrada a anon/authenticated
  assert.match(text, /revoke all on function public\.rc_ordera_create_customer_order_edge/);
});
