const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const failures = [];
const checks = [];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function check(condition, message) {
  checks.push({ passed: Boolean(condition), message });
  if (!condition) failures.push(message);
}

function idsFromHtml(source) {
  return [...source.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
}

function referencedIds(source) {
  return [...source.matchAll(/document\.querySelector\(["']#([A-Za-z][\w:-]*)["']\)/g)].map((match) => match[1]);
}

function generatedIds(source) {
  const templateIds = [...source.matchAll(/\bid=["']([A-Za-z][\w:-]*)["']/g)].map((match) => match[1]);
  const assignedIds = [...source.matchAll(/\.id\s*=\s*["']([A-Za-z][\w:-]*)["']/g)].map((match) => match[1]);
  return new Set([...templateIds, ...assignedIds]);
}

const pages = [
  ["index.html", "app.js"],
  ["cliente.html", "cliente.js"],
  ["mesero.html", "mesero.js"],
  ["colaborador.html", "colaborador.js"],
  ["admin.html", "admin.js"],
];

for (const [htmlFile, jsFile] of pages) {
  const html = read(htmlFile);
  const script = read(jsFile);
  const ids = idsFromHtml(html);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  check(duplicates.length === 0, `${htmlFile}: duplicate IDs: ${[...new Set(duplicates)].join(", ")}`);
  const dynamicIds = generatedIds(script);
  const missing = [...new Set(referencedIds(script))].filter((id) => !ids.includes(id) && !dynamicIds.has(id));
  check(missing.length === 0, `${jsFile}: selectors missing from ${htmlFile}: ${missing.join(", ")}`);
}

for (const manifest of [
  "manifest.webmanifest",
  "cliente-manifest.webmanifest",
  "colaborador-manifest.webmanifest",
  "admin-manifest.webmanifest",
  "vercel.json",
  "package.json",
  "capacitor.config.json",
]) JSON.parse(read(manifest));

const serviceWorker = read("service-worker.js");
check(serviceWorker.includes("rc-ordera-v85-platform-core"), "PWA cache is not V85");
for (const asset of [...serviceWorker.matchAll(/"\.\/([^"?]+)"/g)].map((match) => match[1])) {
  if (!asset) continue;
  check(fs.existsSync(path.join(ROOT, asset)), `Service worker asset does not exist: ${asset}`);
}

const menuMigration = read("MIGRACION-V85-01-PROTEGER-MENU-Y-AJUSTES.sql");
const operationsMigration = read("MIGRACION-V85-02-ESTACIONES-TURNOS-CIERRES.sql");
const paymentsMigration = read("MIGRACION-V85-03-PAGOS-MARKETPLACE.sql");
for (const [file, source] of [
  ["MIGRACION-V85-01", menuMigration],
  ["MIGRACION-V85-02", operationsMigration],
  ["MIGRACION-V85-03", paymentsMigration],
]) {
  check(!/\bdrop\s+table\b|\btruncate\b|disable\s+row\s+level\s+security/i.test(source), `${file}: destructive SQL detected`);
  check(source.includes("notify pgrst, 'reload schema';"), `${file}: PostgREST schema reload is missing`);
}

check(menuMigration.includes("save_current_restaurant_menu"), "Safe menu save RPC is missing");
check(menuMigration.includes("clear_current_restaurant_menu"), "Safe menu clear RPC is missing");
check(menuMigration.includes("restaurant_menu_backups"), "Menu backups are missing");
check(operationsMigration.includes("waiter_monthly_closures"), "Waiter monthly closures are missing");
check(operationsMigration.includes("close_my_waiter_month"), "Waiter monthly close RPC is missing");
for (const station of ["kitchen", "grill", "drinks", "fast_food", "starters", "salads", "packing"]) {
  check(operationsMigration.includes(`'${station}'`), `Operational station is missing: ${station}`);
}
check(/restaurant_fee_bps integer not null default 500/.test(paymentsMigration), "Restaurant fee is not 5%");
check(/courier_fee_bps integer not null default 10/.test(paymentsMigration), "Courier fee is not 0.1%");
check(paymentsMigration.includes("delivery_completion_confirmations"), "Double delivery confirmation is missing");
check(paymentsMigration.includes("round(restaurant_net_amount + courier_net_amount + platform_amount, 2) = round(gross_amount, 2)"), "Payment reconciliation constraint is missing");
check(!paymentsMigration.includes("create trigger rc_ordera_restaurant_release_eligibility_trigger"), "Restaurant funds must require explicit restaurant confirmation");

for (const edgeFunction of [
  "marketplace-onboarding",
  "marketplace-checkout",
  "marketplace-webhook",
  "marketplace-settlement",
  "marketplace-confirm-delivery",
  "marketplace-release-order",
]) check(fs.existsSync(path.join(ROOT, "supabase", "functions", edgeFunction, "index.ts")), `Edge Function is missing: ${edgeFunction}`);

const checkoutFunction = read("supabase/functions/marketplace-checkout/index.ts");
const settlementFunction = read("supabase/functions/marketplace-settlement/index.ts");
check(checkoutFunction.includes("Could not reserve checkout") && checkoutFunction.includes('reserveError.code !== "23505"'), "Checkout concurrency reservation is missing");
check(settlementFunction.includes("restaurantError") && settlementFunction.includes("courierError"), "Restaurant and courier settlements are not independent");

const publicConfig = read("supabase-config.js");
check(!/service[_-]?role|sb_secret|STRIPE_SECRET|WEBHOOK_SECRET/i.test(publicConfig), "Private secret detected in public configuration");
check(read("scripts/prepare-capacitor.mjs").includes("Missing runtime file"), "Android asset validation is missing");

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`RC ORDERA V85 static QA: OK (${checks.length} checks)`);
}
