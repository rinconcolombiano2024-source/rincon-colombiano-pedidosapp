#!/usr/bin/env node
/**
 * Uso: node accounting/bin/close.mjs --daily 2026-10-10 --input export.json [--default-vat 8] [--fiscal-required]
 *      node accounting/bin/close.mjs --monthly 2026-10 --days-dir ./cierres
 * export.json = { orders, payments, refunds, allocations, fiscalOps } (ver daily-close.mjs).
 * Escribe cierre-AAAA-MM-DD.json y .csv; sale con código 1 si hay incidencias (cierre NO válido).
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { buildDailyClose } from "../src/daily-close.mjs";
import { buildMonthlyClose } from "../src/monthly-close.mjs";
import { fromGrosz } from "../src/money.mjs";

const a = process.argv.slice(2);
const arg = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
if (arg("--daily")) {
  const date = arg("--daily");
  const c = buildDailyClose(JSON.parse(readFileSync(arg("--input"), "utf8")), { date, defaultVatRate: arg("--default-vat") ?? null, fiscalRequired: a.includes("--fiscal-required") });
  writeFileSync(`cierre-${date}.json`, JSON.stringify(c, null, 2));
  const rows = [["tasa", "bruto", "neto", "iva"], ...Object.entries(c.vat.byRate).map(([r, v]) => [r, fromGrosz(v.gross), fromGrosz(v.net), fromGrosz(v.vat)])];
  writeFileSync(`cierre-${date}.csv`, rows.map((r) => r.join(";")).join("\n") + "\n");
  console.log(`Cierre ${date}: ${c.orders} pedidos, bruto ${fromGrosz(c.grossGrosz)} PLN, reembolsos ${fromGrosz(c.refundsGrosz)}, incidencias ${c.issues.length}`);
  for (const i of c.issues) console.log(`  ! ${i.code} ${i.ref} ${i.detail}`);
  process.exit(c.issues.length ? 1 : 0);
} else if (arg("--monthly")) {
  const dir = arg("--days-dir") || ".";
  const days = readdirSync(dir).filter((f) => /^cierre-\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
  const m = buildMonthlyClose(days, arg("--monthly"));
  writeFileSync(`cierre-mensual-${m.month}.json`, JSON.stringify(m, null, 2));
  console.log(`Mes ${m.month}: ${m.days} días, bruto ${fromGrosz(m.grossGrosz)} PLN, faltan ${m.missingDays.length} días, incidencias ${m.issuesCount}, completo=${m.complete}`);
  process.exit(m.complete ? 0 : 1);
} else { console.error("Indica --daily AAAA-MM-DD o --monthly AAAA-MM"); process.exit(2); }
