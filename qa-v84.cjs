const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = __dirname;
const PORT = process.env.RC_ORDERA_QA_PORT || "8765";
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function count(source, fragment) {
  return source.split(fragment).length - 1;
}

async function runBrowserSmoke() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const cases = [
    ["home-mobile", "/index.html?app=v84", { width: 390, height: 844 }],
    ["customer-mobile", "/cliente.html?app=v84", { width: 390, height: 844 }],
    ["courier-mobile", "/colaborador.html?app=v84", { width: 390, height: 844 }],
    ["waiter-mobile", "/mesero.html?app=v84", { width: 390, height: 844 }],
    ["admin-desktop", "/admin.html?app=v84", { width: 1440, height: 900 }],
  ];

  for (const [name, route, viewport] of cases) {
    const page = await browser.newPage({ viewport });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${PORT}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      duplicateIds: [...document.querySelectorAll("[id]")]
        .map((element) => element.id)
        .filter((id, index, all) => all.indexOf(id) !== index),
    }));
    check(pageErrors.length === 0, `${name}: errores JavaScript: ${pageErrors.join(" | ")}`);
    check(metrics.duplicateIds.length === 0, `${name}: IDs duplicados: ${metrics.duplicateIds.join(", ")}`);
    check(metrics.scrollWidth <= metrics.width + 2, `${name}: desbordamiento horizontal`);
    await page.close();
  }
  await browser.close();
}

async function main() {
  const courier = read("colaborador.js");
  const customer = read("cliente.js");
  const admin = read("admin.js");
  const sw = read("service-worker.js");
  const v82 = read("MIGRACION-FASE1-V82-ESTABILIDAD-CORE.sql");
  const v83 = read("MIGRACION-FASE2-V83-DESPACHO-PERSISTENTE.sql");
  const v84 = read("MIGRACION-FASES3-5-V84-EXPERIENCIA-CRECIMIENTO-FINANZAS.sql");

  check(courier.includes('rpc("set_courier_availability"'), "Colaborador: falta RPC de disponibilidad explicita");
  check(courier.includes("courierStartDeliveryRealtime"), "Colaborador: falta Realtime de entregas");
  check(!/status\s*===\s*["']accepted["'][\s\S]{0,180}courierAvailable\s*=\s*false/.test(courier), "Colaborador: aceptar cambia disponibilidad local a false");
  check(!/status\s*===\s*["']delivered["'][\s\S]{0,180}courierAvailable\s*=\s*true/.test(courier), "Colaborador: entregar fuerza disponibilidad local");
  check(customer.includes("customerRepeatHistoryOrder"), "Cliente: falta repetir pedido");
  check(customer.includes('rpc("toggle_customer_favorite"'), "Cliente: falta favorito validado por RPC");
  check(!customer.includes('.from("customer_orders").insert'), "Cliente: existe insercion directa de pedidos");
  check(!admin.includes('data-action="approve" ${row.status === "approved"'), "Admin: sigue mostrando Aprobar para approved");
  check(sw.includes("rc-ordera-v84-platform-core"), "PWA: cache no actualizado a V84");
  check(v82.includes("create or replace function public.create_customer_order"), "V82: falta pedido validado en servidor");
  check(v83.includes("create or replace function public.rc_ordera_process_delivery_queue"), "V83: falta despachador automatico");
  check(v83.includes("location_is_stale"), "V83: falta separar disponibilidad y antiguedad GPS");
  check(v84.includes("create table if not exists public.customer_favorites"), "V84: falta favoritos");
  check(v84.includes("create table if not exists public.payment_transactions"), "V84: falta preparacion financiera");
  check(count(v83, "notify pgrst, 'reload schema';") === 1, "V83: recarga PostgREST incorrecta");
  check(count(v84, "notify pgrst, 'reload schema';") === 1, "V84: recarga PostgREST incorrecta");

  for (const manifest of [
    "manifest.webmanifest",
    "cliente-manifest.webmanifest",
    "colaborador-manifest.webmanifest",
    "admin-manifest.webmanifest",
    "vercel.json",
  ]) JSON.parse(read(manifest));

  await runBrowserSmoke();

  if (failures.length) {
    console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log("RC ORDERA V84 QA: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
