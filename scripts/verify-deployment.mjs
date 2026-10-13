#!/usr/bin/env node
/**
 * Verificador POST-DESPLIEGUE (se ejecuta contra TU entorno real, no contra un simulador).
 *   SITE_URL=https://tu-sitio.vercel.app \
 *   FUNCTIONS_URL=https://<proyecto>.supabase.co/functions/v1 \
 *   node scripts/verify-deployment.mjs
 * Sale con código 1 si algo falla. No envía datos de clientes ni crea pedidos.
 */
const SITE = (process.env.SITE_URL || "").replace(/\/$/, "");
const FN = (process.env.FUNCTIONS_URL || "").replace(/\/$/, "");
const EVIL = "https://evil.example";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "OK    " : "FALLO "} ${name}${detail ? " — " + detail : ""}`); };
const warn = (name, ok, detail = "") => console.log(`${ok ? "OK    " : "AVISO "} ${name}${detail ? " — " + detail : ""}`);
const get = (url, init) => fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000), ...init });

if (!SITE) { console.error("Falta SITE_URL"); process.exit(2); }

// 1) Archivos internos NO deben servirse
for (const f of ["supabase-schema.sql", "GUIA-ACCESO-ADMIN-V70.txt", "GUIA-RECUPERACION-ADMIN-V67.txt", "MIGRACION-V5-20261010-01-FISCAL-AGENT-RESULT.sql", "SECURITY.md", "PERFORMANCE-RESULTS.json", "AUDIT-INVENTORY.json", "HARDENING-REPORT.md", "package.json", "supabase/config.toml", "fiscal-agent/src/agent.mjs", "delivery-bridge/src/canonical.mjs", ".env"]) {
  const r = await get(`${SITE}/${f}`);
  check(`/${f} no es público`, r.status === 404 || r.status === 403, `HTTP ${r.status}`);
}
// 2) Páginas y cabeceras
for (const p of ["index.html", "cliente.html", "restaurante.html", "colaborador.html", "mesero.html", "admin.html"]) {
  const r = await get(`${SITE}/${p}`);
  check(`${p} responde 200`, r.status === 200, `HTTP ${r.status}`);
}
const h = (await get(`${SITE}/index.html`)).headers;
check("HSTS activo", /max-age=\d{7,}/.test(h.get("strict-transport-security") || ""));
check("X-Content-Type-Options nosniff", h.get("x-content-type-options") === "nosniff");
check("CSP presente (activa o Report-Only)", Boolean(h.get("content-security-policy") || h.get("content-security-policy-report-only")));
const activeCsp = h.get("content-security-policy") || "";
check("CSP ACTIVA sin 'unsafe-eval'", activeCsp !== "" && !activeCsp.includes("unsafe-eval"), activeCsp.includes("unsafe-eval") ? "aún permite unsafe-eval: pendiente" : "");

// 3) Edge Functions
if (FN) {
  for (const name of ["marketplace-checkout", "create-customer-order", "translate-public-content", "marketplace-confirm-delivery"]) {
    const r = await get(`${FN}/${name}`, { method: "OPTIONS", headers: { origin: EVIL, "access-control-request-method": "POST" } });
    check(`${name}: preflight desde origen no permitido se rechaza`, r.status === 403 || !r.headers.get("access-control-allow-origin"), `HTTP ${r.status} ACAO=${r.headers.get("access-control-allow-origin")}`);
    const ok = await get(`${FN}/${name}`, { method: "OPTIONS", headers: { origin: SITE, "access-control-request-method": "POST" } });
    check(`${name}: origen propio permitido`, ok.headers.get("access-control-allow-origin") === SITE, `ACAO=${ok.headers.get("access-control-allow-origin")} (si falla: añade tu dominio a RC_ALLOWED_ORIGINS)`);
  }
  const gw = await get(`${FN}/fiscal-agent-gateway`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  check("fiscal-agent-gateway rechaza peticiones sin token", gw.status === 401, `HTTP ${gw.status}${gw.status === 503 ? " — servicio sin configurar/no disponible" : ""}`);
  const wh = await get(`${FN}/external-delivery-webhook`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  check("external-delivery-webhook rechaza peticiones sin firma", wh.status === 401, `HTTP ${wh.status}${wh.status === 503 ? " — servicio sin configurar/no disponible" : ""}`);
  const st = await get(`${FN}/marketplace-webhook`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  check("marketplace-webhook (Stripe) rechaza peticiones sin firma", [400, 401, 403].includes(st.status), `HTTP ${st.status}${st.status === 503 ? " — webhook sin configurar/no disponible" : ""}`);
  const dd = await get(`${FN}/delivery-dispatch`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  check("delivery-dispatch rechaza sin secreto", [401, 403].includes(dd.status), `HTTP ${dd.status}`);
} else console.log("(omitido) Defina FUNCTIONS_URL para verificar las Edge Functions");

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`);
process.exit(failed.length ? 1 : 0);
