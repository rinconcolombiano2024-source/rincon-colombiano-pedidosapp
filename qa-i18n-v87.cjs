const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = __dirname;
const failures = [];
const warnings = [];
let checks = 0;

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function extractObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`No se encontro ${marker}`);
  const start = source.indexOf("{", markerIndex + marker.length);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Objeto incompleto para ${marker}`);
}

function evaluateObject(source, marker) {
  return vm.runInNewContext(`(${extractObject(source, marker)})`, {}, { timeout: 1000 });
}

function normalize(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function decodeHtml(value) {
  return normalize(String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">"));
}

function looksVisible(value) {
  const text = normalize(value);
  if (!text || !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(text)) return false;
  if (/^(https?:|\.\/|#|[.#][\w-]+|[\w-]+\.(js|css|html|png|jpg|svg|webmanifest))/.test(text)) return false;
  if (/^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(text)) return false;
  return true;
}

function exposesTechnicalDetail(value) {
  return /\b(?:Supabase|PGRST\d*|SQLSTATE|RPC|migraci[oó]n|stack trace|undefined|null)\b|\/rest\/v1/i.test(normalize(value));
}

function readJsLiteral(source, start) {
  const quote = source[start];
  if (!['"', "'", "`"].includes(quote)) return null;
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) return { raw: source.slice(start + 1, index), end: index + 1, quote };
  }
  return null;
}

function dynamicCandidates(raw, isHtml = false) {
  const value = String(raw || "").replace(/\$\{[^}]+\}/g, "VALOR");
  if (!isHtml) return [decodeHtml(value)];
  return [...value.matchAll(/>([^<>]+)</g)]
    .map((match) => decodeHtml(match[1]))
    .filter(Boolean);
}

const intentionalLiterals = new Set([
  "RC ORDERA", "Español", "Espanol", "Polski", "English", "zł", "NIP / VAT",
  "AIza...", "VACIAR MENU", "ELIMINAR", "x", "Google Maps API key",
]);

const offlineWindow = {};
vm.runInNewContext(read("offline-i18n.js"), { window: offlineWindow }, { timeout: 1000 });
const offline = offlineWindow.RC_ORDERA_OFFLINE_I18N;
check(Boolean(offline), "No se pudo cargar el catalogo offline");

const offlineKeys = offline.rows.map((row) => row[0]);
check(new Set(offlineKeys).size === offlineKeys.length, "Catalogo offline: claves duplicadas");
for (const row of offline.rows) {
  check(row.length >= 4, `Catalogo offline: fila incompleta ${row[0]}`);
  check(row.slice(0, 4).every((value) => normalize(value)), `Catalogo offline: valor vacio ${row[0]}`);
}
const patternKeys = offline.patterns.map((pattern) => pattern.key);
check(new Set(patternKeys).size === patternKeys.length, "Catalogo offline: patrones duplicados");
check(patternKeys.every((key) => !offlineKeys.includes(key)), "Catalogo offline: una key se repite entre texto y patron");

const autoDictionary = evaluateObject(read("auto-translate.js"), "const dictionary =");
const customerDictionary = evaluateObject(read("cliente.js"), "const CUSTOMER_I18N =");
for (const language of ["es", "pl", "en"]) {
  check(Boolean(offline.catalog[language]), `Catalogo offline: falta ${language}`);
  check(Object.keys(offline.catalog[language]).length === offline.rows.length, `Catalogo offline: conteo desigual ${language}`);
  check(Boolean(customerDictionary[language]), `Cliente: falta diccionario ${language}`);
}

const customerKeySets = Object.fromEntries(["es", "pl", "en"].map((language) => [language, new Set(Object.keys(customerDictionary[language]))]));
for (const language of ["pl", "en"]) {
  check(
    [...customerKeySets.es].every((key) => customerKeySets[language].has(key))
      && [...customerKeySets[language]].every((key) => customerKeySets.es.has(key)),
    `Cliente: claves diferentes entre es y ${language}`
  );
  check(Object.values(customerDictionary[language]).every((value) => normalize(value)), `Cliente: traduccion vacia en ${language}`);
}

const legacyOnlySources = new Set();
function covered(source, language) {
  const text = normalize(source);
  if (offline.translate(text, language)) return true;
  if (autoDictionary[language]?.[text]) {
    legacyOnlySources.add(text);
    return true;
  }
  return language === "es" && Boolean(text);
}

const autoPages = ["index.html", "colaborador.html", "mesero.html", "admin.html"];
for (const file of autoPages) {
  const original = read(file);
  const html = original
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  const candidates = [];
  for (const match of html.matchAll(/\b(?:placeholder|title|aria-label|aria-description|alt)\s*=\s*["']([^"']+)["']/gi)) {
    candidates.push(decodeHtml(match[1]));
  }
  for (const match of html.matchAll(/>([^<>]+)</g)) candidates.push(decodeHtml(match[1]));
  const uncovered = [...new Set(candidates.filter(looksVisible))]
    .filter((text) => !intentionalLiterals.has(text))
    .filter((text) => !covered(text, "pl") || !covered(text, "en"));
  check(uncovered.length === 0, `${file}: textos estaticos sin cobertura: ${uncovered.join(" | ")}`);
  const technical = [...new Set(candidates.filter(looksVisible).filter(exposesTechnicalDetail))];
  check(technical.length === 0, `${file}: detalles tecnicos visibles: ${technical.join(" | ")}`);
}

const customerHtml = read("cliente.html");
const customerKeysUsed = [
  ...customerHtml.matchAll(/data-i18n(?:-placeholder|-aria-label)?=["']([^"']+)["']/g),
].map((match) => match[1]);
const missingCustomerKeys = [...new Set(customerKeysUsed)].filter((key) => !customerKeySets.es.has(key));
check(missingCustomerKeys.length === 0, `Cliente HTML: keys inexistentes: ${missingCustomerKeys.join(", ")}`);

for (const [file, dictionaryName] of [
  ["manifest.webmanifest", "restaurante"],
  ["cliente-manifest.webmanifest", "cliente"],
  ["colaborador-manifest.webmanifest", "colaborador"],
  ["mesero-manifest.webmanifest", "mesero"],
  ["admin-manifest.webmanifest", "admin"],
]) {
  const base = JSON.parse(read(file));
  for (const language of ["pl", "en"]) {
    const localizedFile = file.replace(".webmanifest", `.${language}.webmanifest`);
    const localized = JSON.parse(read(localizedFile));
    check(Boolean(localized.name && localized.short_name && localized.description), `Manifest ${dictionaryName}/${language}: texto vacio`);
    check(localized.start_url.includes(`lang=${language}`), `Manifest ${dictionaryName}/${language}: idioma ausente en start_url`);
  }
  check(Boolean(base.name && base.short_name && base.description), `Manifest ${dictionaryName}/es: texto vacio`);
}

const runtimeFiles = [
  "index.html", "cliente.html", "colaborador.html", "mesero.html", "admin.html",
  "app.js", "cliente.js", "colaborador.js", "mesero.js", "admin.js",
  "auto-translate.js", "offline-i18n.js", "service-worker.js",
];
for (const file of runtimeFiles) {
  const source = read(file);
  check(!/[�]|(?:Ã.|Â.|Å.|Ä.)/.test(source), `${file}: posible caracter roto o mojibake`);
}

for (const file of ["app.js", "colaborador.js", "mesero.js", "admin.js"]) {
  const source = read(file);
  for (const match of source.matchAll(/(?:window\.)?(alert|confirm|prompt)\s*\(\s*(["'`])([\s\S]*?)\2/g)) {
    const raw = normalize(match[3].replace(/\$\{[^}]+\}/g, "VALOR"));
    if (!looksVisible(raw)) continue;
    check(!exposesTechnicalDetail(raw), `${file}: dialogo expone detalles tecnicos: ${raw}`);
    check(covered(raw, "pl") && covered(raw, "en"), `${file}: dialogo sin cobertura: ${raw}`);
  }
}

const dynamicUncovered = new Set();
for (const file of ["app.js", "colaborador.js", "mesero.js", "admin.js"]) {
  const source = read(file);
  const sinkPattern = /(?:\.(textContent|innerText|innerHTML)\s*=|\b(?:set|update|adminSet|courierSet|waiterSet)[A-Za-z0-9_]*(?:Status|Message)\s*\()\s*/g;
  for (const match of source.matchAll(sinkPattern)) {
    const literal = readJsLiteral(source, match.index + match[0].length);
    if (!literal) continue;
    const texts = dynamicCandidates(literal.raw, match[1] === "innerHTML");
    for (const text of texts) {
      if (!looksVisible(text) || intentionalLiterals.has(text) || /@media|!important/.test(text) || /^(?:VALOR\s*)+$/.test(text) || /^VALOR\s*\/\s*VALOR$/.test(text)) continue;
      if (exposesTechnicalDetail(text)) dynamicUncovered.add(`${file}: detalle tecnico visible: ${text}`);
      if (!covered(text, "pl") || !covered(text, "en")) dynamicUncovered.add(`${file}: ${text}`);
    }
  }
  for (const match of source.matchAll(/(?:throw\s+)?new Error\(\s*/g)) {
    const literal = readJsLiteral(source, match.index + match[0].length);
    if (!literal) continue;
    const text = dynamicCandidates(literal.raw)[0];
    if (!looksVisible(text)) continue;
    if (exposesTechnicalDetail(text)) dynamicUncovered.add(`${file}: detalle tecnico visible: ${text}`);
    if (!covered(text, "pl") || !covered(text, "en")) dynamicUncovered.add(`${file}: ${text}`);
  }
}
check(dynamicUncovered.size === 0, `Textos dinamicos sin cobertura local: ${[...dynamicUncovered].join(" | ")}`);

const clientSource = read("cliente.js");
check(!/(?:window\.)?(?:alert|confirm|prompt)\s*\(\s*["'`]/.test(clientSource), "cliente.js: dialogo hardcodeado fuera de customerT");
check(read("service-worker.js").includes("language") && read("service-worker.js").includes("Nowa dostawa"), "Push PWA: falta traduccion local");
check(read("supabase/functions/courier-push/index.ts").includes("preferred_language"), "Push backend: no usa el idioma del colaborador");

const totals = {
  offlineKeys: offline.rows.length,
  patternKeys: offline.patterns.length,
  autoPl: Object.keys(autoDictionary.pl || {}).length,
  autoEn: Object.keys(autoDictionary.en || {}).length,
  customerEs: customerKeySets.es.size,
  customerPl: customerKeySets.pl.size,
  customerEn: customerKeySets.en.size,
  legacyOnlyVisible: legacyOnlySources.size,
};

if (legacyOnlySources.size) {
  console.log(`Textos visibles cubiertos solo por diccionario anterior (${legacyOnlySources.size}): ${[...legacyOnlySources].join(" | ")}`);
}

if (warnings.length) console.warn(warnings.map((warning) => `WARN: ${warning}`).join("\n"));
if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  console.error(`Totales: ${JSON.stringify(totals)}`);
  process.exitCode = 1;
} else {
  console.log(`RC ORDERA V87 i18n QA: OK (${checks} comprobaciones)`);
  console.log(`Totales: ${JSON.stringify(totals)}`);
}
