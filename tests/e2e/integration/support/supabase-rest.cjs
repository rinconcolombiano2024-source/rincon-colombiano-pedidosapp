const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "../../..");

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function configuredProductionUrl() {
  const source = fs.readFileSync(path.join(PROJECT_ROOT, "supabase-config.js"), "utf8");
  return normalizeUrl(source.match(/\burl\s*:\s*["']([^"']+)["']/)?.[1]);
}

function integrationConfig() {
  return {
    url: normalizeUrl(process.env.RC_TEST_SUPABASE_URL),
    anonKey: String(process.env.RC_TEST_SUPABASE_ANON_KEY || "").trim(),
    confirmed: process.env.RC_TEST_CONFIRM_TEST_PROJECT === "YES",
    productionUrl: configuredProductionUrl(),
  };
}

function integrationGate(requiredActors = []) {
  const config = integrationConfig();
  const missing = [];
  if (!config.url) missing.push("RC_TEST_SUPABASE_URL");
  if (!config.anonKey) missing.push("RC_TEST_SUPABASE_ANON_KEY");
  if (!config.confirmed) missing.push("RC_TEST_CONFIRM_TEST_PROJECT=YES");
  if (config.url && config.productionUrl && config.url === config.productionUrl) {
    missing.push("un proyecto TEST distinto del proyecto activo de producción");
  }
  for (const actor of requiredActors) {
    const prefix = `RC_TEST_${actor}`;
    const hasToken = Boolean(process.env[`${prefix}_TOKEN`]);
    const hasCredentials = Boolean(process.env[`${prefix}_EMAIL`] && process.env[`${prefix}_PASSWORD`]);
    if (!hasToken && !hasCredentials) missing.push(`${prefix}_TOKEN o ${prefix}_EMAIL/${prefix}_PASSWORD`);
  }
  return {
    config,
    ready: missing.length === 0,
    reason: missing.length ? `Pendiente de Supabase TEST: falta ${missing.join(", ")}.` : "",
  };
}

function jwtSubject(token) {
  try {
    const payload = String(token).split(".")[1];
    if (!payload) return "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return String(JSON.parse(Buffer.from(normalized, "base64").toString("utf8"))?.sub || "");
  } catch {
    return "";
  }
}

async function authenticateActor(actor, config = integrationConfig()) {
  const prefix = `RC_TEST_${actor}`;
  const suppliedToken = String(process.env[`${prefix}_TOKEN`] || "").trim();
  if (suppliedToken) {
    const userId = jwtSubject(suppliedToken);
    if (!userId) throw new Error(`${prefix}_TOKEN no contiene un subject valido.`);
    return { token: suppliedToken, userId };
  }

  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.anonKey, "content-type": "application/json" },
    body: JSON.stringify({
      email: process.env[`${prefix}_EMAIL`],
      password: process.env[`${prefix}_PASSWORD`],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token || !payload.user?.id) {
    throw new Error(`No se pudo autenticar ${actor} en Supabase TEST (${response.status}).`);
  }
  return { token: payload.access_token, userId: String(payload.user.id) };
}

async function apiRequest({ config = integrationConfig(), token = "", method = "GET", path: requestPath, body }) {
  const headers = {
    apikey: config.anonKey,
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${config.url}${requestPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: response.status, ok: response.ok, data };
}

function restPath(table, select, filters = {}) {
  const search = new URLSearchParams({ select });
  for (const [column, value] of Object.entries(filters)) search.set(column, `eq.${value}`);
  return `/rest/v1/${encodeURIComponent(table)}?${search.toString()}`;
}

function rpcPath(name) {
  return `/rest/v1/rpc/${encodeURIComponent(name)}`;
}

module.exports = {
  apiRequest,
  authenticateActor,
  integrationConfig,
  integrationGate,
  restPath,
  rpcPath,
};
