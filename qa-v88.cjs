const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const vm = require("node:vm");

const ROOT = __dirname;
const failures = [];
let checkCount = 0;

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function check(condition, message) {
  checkCount += 1;
  if (!condition) failures.push(message);
}

function idsFromHtml(source) {
  return [...source.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
}

function referencedIds(source) {
  return [...source.matchAll(/document\.querySelector\(["']#([A-Za-z][\w:-]*)["']\)/g)].map((match) => match[1]);
}

function generatedIds(source) {
  return new Set([
    ...[...source.matchAll(/\bid=["']([A-Za-z][\w:-]*)["']/g)].map((match) => match[1]),
    ...[...source.matchAll(/\.id\s*=\s*["']([A-Za-z][\w:-]*)["']/g)].map((match) => match[1]),
  ]);
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
  check(duplicates.length === 0, `${htmlFile}: IDs duplicados: ${[...new Set(duplicates)].join(", ")}`);
  const dynamicIds = generatedIds(script);
  const missing = [...new Set(referencedIds(script))].filter((id) => !ids.includes(id) && !dynamicIds.has(id));
  check(missing.length === 0, `${jsFile}: selectores inexistentes en ${htmlFile}: ${missing.join(", ")}`);
  check(/auto-translate\.js/.test(html) || /data-i18n=/.test(html), `${htmlFile}: falta el sistema de idiomas`);
  check(/service-worker\.js|register\(\s*["']\.\/service-worker\.js/.test(`${html}\n${script}`), `${htmlFile}: falta registro PWA`);
  check(/styles\.css\?v=88\.0\.0/.test(html), `${htmlFile}: estilos sin version V88`);
  check(new RegExp(`${jsFile.replace(".", "\\.")}\\?v=88\\.0\\.0`).test(html), `${htmlFile}: JavaScript sin version V88`);
}

for (const file of [
  "manifest.webmanifest", "cliente-manifest.webmanifest", "colaborador-manifest.webmanifest",
  "admin-manifest.webmanifest", "vercel.json", "package.json", "capacitor.config.json",
]) {
  JSON.parse(read(file));
  check(true, `${file}: JSON valido`);
}

for (const file of pages.map((entry) => entry[1]).concat(["auto-translate.js", "service-worker.js"])) {
  const result = childProcess.spawnSync(process.execPath, ["--check", path.join(ROOT, file)], { encoding: "utf8" });
  check(result.status === 0, `${file}: sintaxis invalida: ${String(result.stderr || "").trim()}`);
}

const serviceWorker = read("service-worker.js");
check(serviceWorker.includes("rc-ordera-v88-stabilization-core"), "PWA: cache no corresponde a V88");
check(serviceWorker.includes("caches.delete"), "PWA: no limpia caches antiguos");
for (const asset of [...serviceWorker.matchAll(/["']\.\/([^"'?]+)["']/g)].map((match) => match[1])) {
  check(fs.existsSync(path.join(ROOT, asset)), `PWA: recurso inexistente: ${asset}`);
}

const migrations = [
  "MIGRACION-V86-01-INTEGRIDAD-PEDIDOS.sql",
  "MIGRACION-V86-02-PAGOS-SEGUROS-Y-LIQUIDACION.sql",
  "MIGRACION-V86-03-CATALOGO-PUBLICO-SEGURO.sql",
  "MIGRACION-V86-04-TRADUCCIONES-SEGURAS.sql",
  "MIGRACION-V86-05-COTIZACION-Y-VALIDACION-PEDIDOS.sql",
  "MIGRACION-V86-06-ELIMINACION-ATOMICA-RESTAURANTE.sql",
  "MIGRACION-V86-07-ARCHIVOS-COLABORADORES-SEGUROS.sql",
  "MIGRACION-V86-08-AUTORIZACION-ESTACIONES-ESTABLE.sql",
  "MIGRACION-V88-01-SINCRONIZACION-MENU-PUBLICO.sql",
];

for (const file of migrations) {
  const sql = read(file);
  check(!/\bdrop\s+table\b|\btruncate\b|disable\s+row\s+level\s+security/i.test(sql), `${file}: SQL destructivo detectado`);
  check(/\bbegin\s*;/i.test(sql) && /\bcommit\s*;/i.test(sql), `${file}: falta transaccion`);
  check(sql.includes("notify pgrst, 'reload schema';"), `${file}: falta recarga de esquema PostgREST`);
}

const orderIntegrity = read(migrations[0]);
check(orderIntegrity.includes("order_ticket_reservations"), "Pedidos: falta reserva unica de ticket");
check(orderIntegrity.includes("accept_customer_order_atomic"), "Pedidos: falta aceptacion atomica");
check(orderIntegrity.includes("get_restaurant_business_context"), "Pedidos: falta jornada del restaurante");

const payments = read(migrations[1]);
check(/true,\s*500,\s*10,\s*now\(\)/.test(payments), "Pagos: comisiones no son 5% y 0,1%");
check(payments.includes("marketplace_settlement_jobs"), "Pagos: falta cola durable de liquidacion");
check(payments.includes("financial_hold"), "Pagos: falta bloqueo por disputa/reembolso");

const catalog = read(migrations[2]);
check(catalog.includes("restaurant_public_catalogs"), "Menu: falta catalogo publico aislado");
check(/revoke all on table public\.app_settings from anon/i.test(catalog), "Menu: app_settings sigue expuesto a anon");

const quotes = read(migrations[4]);
check(quotes.includes("delivery_quotes"), "Domicilio: falta cotizacion firmada");
check(quotes.includes("create_customer_order"), "Domicilio: falta validacion de pedido en servidor");
check(quotes.includes("unit_price_snapshot"), "Pedidos: faltan precios historicos del producto");

const deletion = read(migrations[5]);
check(deletion.includes("rc_ordera_finalize_restaurant_deletion"), "Privacidad: falta eliminacion atomica del restaurante");
check(!/delete\s+from\s+auth\.users/i.test(deletion), "Privacidad: la migracion intenta borrar Auth directamente");

const stationAuth = read(migrations[7]);
check(stationAuth.includes("confirm_current_restaurant_staff_invitation"), "Personal: falta confirmacion de autorizacion");
check(stationAuth.includes("team.pending desc"), "Personal: no se corrigio el orden de invitaciones pendientes");

const requiredFunctions = [
  "delivery-dispatch", "courier-push", "delivery-quote", "translate-public-content",
  "delete-own-restaurant-account", "marketplace-onboarding", "marketplace-checkout",
  "marketplace-webhook", "marketplace-settlement", "marketplace-confirm-delivery", "marketplace-release-order",
];
for (const name of requiredFunctions) {
  const file = path.join("supabase", "functions", name, "index.ts");
  check(fs.existsSync(path.join(ROOT, file)), `Edge Function faltante: ${name}`);
}

const checkout = read("supabase/functions/marketplace-checkout/index.ts");
const webhook = read("supabase/functions/marketplace-webhook/index.ts");
const settlement = read("supabase/functions/marketplace-settlement/index.ts");
const courierPush = read("supabase/functions/courier-push/index.ts");
check(checkout.includes("Could not reserve checkout") && checkout.includes('reserveError.code !== "23505"'), "Pagos: falta idempotencia de checkout");
check(webhook.includes("verifyStripeSignature") && webhook.includes("STRIPE_WEBHOOK_SECRET"), "Pagos: webhook sin firma Stripe");
check(settlement.includes("restaurantError") && settlement.includes("courierError"), "Pagos: liquidaciones no son independientes");
check(courierPush.includes("app=v88.0.0") && !courierPush.includes("app=v84.1"), "Notificaciones: enlace del colaborador usa una version antigua");

const app = read("app.js");
const waiter = read("mesero.js");
const collaborator = read("colaborador.js");
const customer = read("cliente.js");
check(app.includes("get_current_restaurant_business_context"), "Restaurante: cierres no consultan jornada del servidor");
check(app.includes("loadCloudOrdersForReport") && app.includes(".range(from, from + pageSize - 1)"), "Reportes: cierres no cargan el periodo completo por paginas");
check(waiter.includes("get_restaurant_business_context"), "Mesero: historial no consulta jornada del restaurante");
check(app.includes("new Uint8Array([0x1d, 0x56, 0x00])"), "Impresion: falta comando ESC/POS de corte");
check(app.includes("createReceiptPdfBlob"), "Impresion: falta PDF de altura dinamica");
check(app.includes("loading=async"), "Google Maps restaurante: falta carga asincrona");
check(customer.includes("loading=async"), "Google Maps cliente: falta carga asincrona");
check(collaborator.includes("loading=async"), "Google Maps colaborador: falta carga asincrona");
check(app.includes("verifyPublicMenuProjection") && app.includes("PUBLIC_MENU_PROJECTION_MISMATCH"), "Menu: el restaurante no confirma la proyeccion publica");
check(app.includes("mergeConcurrentMenuChanges") && app.includes("menuSaveQueue"), "Menu: falta reconciliacion o serializacion de guardados concurrentes");
check(customer.includes("customerMenuRealtimeRetryTimer") && customer.includes("customerDirectoryRealtimeRetryTimer"), "Realtime cliente: falta reconexion controlada");

const translation = read("auto-translate.js");
check(translation.includes("translate-public-content"), "Idiomas: traduccion no usa Edge Function oficial");
check(!/translate\.googleapis|api\.mymemory|libretranslate/i.test(translation), "Idiomas: endpoint publico no autorizado detectado");
check(translation.includes("translationServicePausedUntil"), "Idiomas: falta proteccion ante caidas del traductor");

const customerHtml = read("cliente.html");
const customerI18nBlock = customer.split("const CUSTOMER_I18N = {")[1]?.split("\n};")[0] || "";
const customerEs = customerI18nBlock.split("\n  pl: {")[0] || "";
const customerPlAndEn = customerI18nBlock.split("\n  pl: {")[1] || "";
const customerPl = customerPlAndEn.split("\n  en: {")[0] || "";
const customerEn = customerPlAndEn.split("\n  en: {")[1] || "";
const localeKeys = (source) => new Set([...source.matchAll(/^    ([A-Za-z][A-Za-z0-9_]*):/gm)].map((match) => match[1]));
const esKeys = localeKeys(customerEs);
const plKeys = localeKeys(customerPl);
const enKeys = localeKeys(customerEn);
check([...esKeys].every((key) => plKeys.has(key)) && [...plKeys].every((key) => esKeys.has(key)), "Idiomas cliente: claves diferentes entre espanol y polaco");
check([...esKeys].every((key) => enKeys.has(key)) && [...enKeys].every((key) => esKeys.has(key)), "Idiomas cliente: claves diferentes entre espanol e ingles");
check(/data-i18n="greeting"/.test(customerHtml) && esKeys.has("greeting") && esKeys.has("defaultCustomerName"), "Idiomas cliente: saludo sin traduccion completa");
check(/id="customerGreetingName" hidden/.test(customerHtml), "Cliente: el saludo inicial presenta un nombre falso");
check(!/customerT\(["']defaultCustomerName["']\)/.test(customer), "Cliente: sigue usando el rol Cliente como si fuera el nombre real");
check(customer.includes("CUSTOMER_CATEGORY_LABELS") && customer.includes('all: "Wszystkie"') && customer.includes('all: "All"'), "Idiomas cliente: categorias de descubrimiento sin traduccion local");
check(/data-i18n="homePrompt"/.test(customerHtml) && /data-i18n="categoriesTitle"/.test(customerHtml) && /data-i18n="deliveryTo"/.test(customerHtml), "Idiomas cliente: portada movil con textos fuera del sistema i18n");

const publicConfig = read("supabase-config.js");
check(!/service[_-]?role|sb_secret|STRIPE_SECRET|WEBHOOK_SECRET/i.test(publicConfig), "Configuracion publica: secreto privado detectado");
for (const script of pages.map((entry) => read(entry[1]))) {
  check(!/supabase-js@(?!2\.57\.4)/.test(script), "Dependencias: version Supabase no fijada");
}

const stabilizationMigration = read("MIGRACION-V88-01-SINCRONIZACION-MENU-PUBLICO.sql");
check(stabilizationMigration.includes("rc_ordera_sync_public_restaurant_catalog"), "V88: falta sincronizacion del catalogo publico");
check(stabilizationMigration.includes("get_public_restaurant_menu"), "V88: falta contrato de lectura publica del menu");
check(stabilizationMigration.includes("alter publication supabase_realtime add table public.restaurant_public_catalogs"), "V88: falta publicacion Realtime del menu");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return "";
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  return "";
}

const mergeContext = {
  normalizeMenuCatalog: (menu) => JSON.parse(JSON.stringify(menu || {})),
};
vm.createContext(mergeContext);
for (const name of ["menuProductEntries", "menuProductEntryMatches", "mergeConcurrentMenuChanges"]) {
  const source = extractFunction(app, name);
  check(Boolean(source), `Menu: no se encontro ${name}`);
  if (source) vm.runInContext(source, mergeContext);
}
if (typeof mergeContext.mergeConcurrentMenuChanges === "function") {
  const base = { Entradas: [{ id: "p1", name: "Sopa", price: 10 }, { id: "p2", name: "Pan", price: 4 }] };
  const local = { Entradas: [{ id: "p1", name: "Sopa", price: 12 }, { id: "p2", name: "Pan", price: 4 }] };
  const remote = { Entradas: [{ id: "p1", name: "Sopa", price: 10 }, { id: "p2", name: "Pan", price: 5 }, { id: "p3", name: "Jugo", price: 7 }] };
  const merged = mergeContext.mergeConcurrentMenuChanges(base, local, remote);
  const byId = new Map(merged.Entradas.map((product) => [product.id, product]));
  check(byId.get("p1")?.price === 12, "Menu: la edicion local se pierde durante la reconciliacion");
  check(byId.get("p2")?.price === 5, "Menu: una edicion remota independiente se pierde durante la reconciliacion");
  check(byId.has("p3"), "Menu: un producto remoto nuevo se pierde durante la reconciliacion");
}

if (fs.existsSync(path.join(ROOT, "www"))) {
  for (const file of pages.flat().concat([
    "styles.css", "auto-translate.js", "service-worker.js", "supabase-config.js",
    "manifest.webmanifest", "cliente-manifest.webmanifest", "colaborador-manifest.webmanifest", "admin-manifest.webmanifest",
  ])) {
    check(read(file) === read(path.join("www", file)), `Android/www desactualizado: ${file}`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`RC ORDERA V88 static QA: OK (${checkCount} checks)`);
}
