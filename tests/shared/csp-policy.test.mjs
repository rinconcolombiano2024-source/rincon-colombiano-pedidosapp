import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const header = (k) => vercel.headers.flatMap((h) => h.headers).find((h) => h.key === k)?.value ?? "";
const scriptSrc = (csp) => (/script-src([^;]*)/.exec(csp)?.[1] ?? "").trim().split(/\s+/);
const SERVED = [...readdirSync(".").filter((f) => f.endsWith(".html") && f !== "index-restaurante-backup.html"),
  ...readdirSync("www").filter((f) => f.endsWith(".html")).map((f) => `www/${f}`)];

const inline = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).filter((b) => b.trim());

test("CSP activa y Report-Only: sin 'unsafe-inline' ni 'unsafe-eval' en script-src", () => {
  for (const k of ["Content-Security-Policy", "Content-Security-Policy-Report-Only"]) {
    const src = scriptSrc(header(k));
    assert.ok(src.length > 1, `${k} sin script-src`);
    assert.ok(!src.includes("'unsafe-inline'") && !src.includes("'unsafe-eval'"), `${k} permite unsafe-*`);
  }
  assert.match(header("Content-Security-Policy"), /object-src 'none'/);
});

test("todo script inline de las páginas servidas tiene su hash en la CSP (y no hay manejadores inline)", () => {
  const allowed = new Set(scriptSrc(header("Content-Security-Policy")));
  let seen = 0;
  for (const f of SERVED) {
    const html = readFileSync(f, "utf8");
    for (const body of inline(html)) {
      seen++;
      const h = `'sha256-${createHash("sha256").update(body).digest("base64")}'`;
      assert.ok(allowed.has(h), `${f}: el script inline no está autorizado por hash (${h})`);
    }
    assert.equal(/\son(click|change|input|submit|load|error|keydown|keyup|focus|blur)\s*=/i.test(html), false, `${f}: manejador inline`);
    assert.equal(/href\s*=\s*["']\s*javascript:/i.test(html), false, `${f}: javascript: href`);
  }
  assert.ok(seen >= 1);
});

test("los hashes autorizados corresponden a un script existente (sin hashes obsoletos)", () => {
  const present = new Set(SERVED.flatMap((f) => inline(readFileSync(f, "utf8")).map((b) => `'sha256-${createHash("sha256").update(b).digest("base64")}'`)));
  for (const tok of scriptSrc(header("Content-Security-Policy")).filter((t) => t.startsWith("'sha256-"))) assert.ok(present.has(tok), `hash obsoleto: ${tok}`);
});
