#!/usr/bin/env node
// Escáner de secretos sin dependencias. Falla (exit 1) si encuentra credenciales privadas.
// Uso: node scripts/scan-secrets.mjs [directorio]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.argv[2] || ".";
const SKIP_DIRS = new Set([".git", "node_modules", "vendor", "android", "test-results", "playwright-report"]);
const SKIP_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|zip|pdf|mp4|webm)$/i;
const MAX_BYTES = 2_000_000;

// Claves que SON públicas por diseño (se avisa, no se falla). Deben estar restringidas en su consola.
const PUBLIC_WARN = [
  { re: /AIza[0-9A-Za-z_-]{30,}/g, name: "Google API key (debe tener restricción de referrer y de API)" },
];
const FAIL = [
  { re: /sk_live_[0-9A-Za-z]{16,}/g, name: "Stripe secret key (live)" },
  { re: /rk_live_[0-9A-Za-z]{16,}/g, name: "Stripe restricted key (live)" },
  { re: /whsec_[0-9A-Za-z]{16,}/g, name: "Stripe webhook secret" },
  { re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g, name: "Clave privada" },
  { re: /AKIA[0-9A-Z]{16}/g, name: "AWS access key" },
  { re: /sb_secret_[0-9A-Za-z_-]{16,}/g, name: "Supabase secret key" },
];
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (st.size <= MAX_BYTES && !SKIP_EXT.test(name)) yield full;
  }
}

function jwtRole(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8")).role;
  } catch { return null; }
}

const failures = [];
const warnings = [];
for (const file of walk(root)) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  const rel = relative(root, file);
  // Las guías/documentos pueden mencionar formatos de ejemplo; se ignoran valores con "xxx" o "example".
  const looksPlaceholder = (m) => /x{4,}|example|your[_-]|\*{3,}|<[^>]+>/i.test(m);
  for (const { re, name } of FAIL) {
    for (const m of text.matchAll(re)) if (!looksPlaceholder(m[0])) failures.push(`${rel}: ${name}`);
  }
  for (const m of text.matchAll(JWT)) {
    if (jwtRole(m[0]) === "service_role") failures.push(`${rel}: JWT con rol service_role`);
  }
  for (const { re, name } of PUBLIC_WARN) {
    for (const m of text.matchAll(re)) warnings.push(`${rel}: ${name}`);
  }
}
const uniq = (a) => [...new Set(a)];
for (const w of uniq(warnings)) console.warn("AVISO  " + w);
if (failures.length) {
  for (const f of uniq(failures)) console.error("FALLO  " + f);
  console.error(`\n${uniq(failures).length} secreto(s) privado(s) detectado(s). Rótalos y elimínalos del historial.`);
  process.exit(1);
}
console.log("scan-secrets: sin secretos privados detectados.");
