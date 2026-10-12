/**
 * Novitus online (NoviAPI, HTTP) — PROVISIONAL.
 * Flujo implementado: POST comando -> PUT confirmar -> GET sondeo, con token JWT.
 * Las rutas y campos son configurables y DEBEN contrastarse con la documentación oficial de NoviAPI
 * y probarse con una impresora real en modo de pruebas antes de usarlo.
 */
import { FiscalDriver, FiscalError } from "../../../fiscal-bridge/src/fiscal-contract.mjs";

const DEFAULT_ENDPOINTS = Object.freeze({ login: "/api/token", command: "/api/command", status: "/api/status" });
// Las letras PTU (A..G) las define la CONFIGURACIÓN FISCAL de cada dispositivo, no son universales.
// No existe mapa por defecto: debe pasarse `taxMap` explícito y verificado ({ "23": "A", ... } según la impresora).
function assertTaxMap(map) {
  const plain = map && typeof map === "object" && !Array.isArray(map);
  const entries = plain ? Object.entries(map) : [];
  if (!entries.length || entries.some(([k, v]) => !/^(23|8|5|0|ZW|NP|NP I|NP II)$/.test(k) || !/^[A-G]$/.test(String(v)))) {
    throw new FiscalError("NOT_CONFIGURED", "An explicit, verified taxMap (rate -> device PTU letter) is required");
  }
  const numericLetters = new Set();
  for (const [rate, letter] of entries) {
    if (!/^(23|8|5|0)$/.test(rate)) continue;
    if (numericLetters.has(letter)) throw new FiscalError("NOT_CONFIGURED", "Distinct numeric VAT rates cannot share a PTU letter");
    numericLetters.add(letter);
  }
  return Object.freeze({ ...map });
}

export function taxLetter(taxCode, map) {
  assertTaxMap(map);
  const raw = String(taxCode ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  // Una letra solo es válida si es una letra CONFIGURADA en este dispositivo.
  if (/^[A-G]$/.test(raw)) {
    if (Object.values(map).includes(raw)) return raw;
    throw new FiscalError("FAILED_BEFORE_SEND", `Tax letter not configured on device: ${raw}`);
  }
  const key = raw === "EXEMPT" ? "ZW" : /^(ZW|NP|NP I|NP II)$/.test(raw) ? raw : raw.replace(/^VAT[_\s-]*/, "").replace(/\s*%$/, "");
  const letter = Object.hasOwn(map, key) ? map[key] : undefined;
  if (!letter) throw new FiscalError("FAILED_BEFORE_SEND", `Unmapped tax code: ${raw}`);
  return letter;
}

const zl = (grosz) => (grosz / 100).toFixed(2);

export class NovitusNoviApiDriver extends FiscalDriver {
  #o; #token = null;
  constructor(options = {}) {
    super();
    if (!options.baseUrl || !options.username || !options.password) {
      throw new FiscalError("NOT_CONFIGURED", "baseUrl, username and password are required");
    }
    if (options.simulationOnly !== true || typeof options.fetchImpl !== "function" || options.fetchImpl === globalThis.fetch) {
      throw new FiscalError("PROTOCOL_UNVERIFIED", "NoviAPI template is simulation-only until official protocol and hardware review");
    }
    const limits = { pollIntervalMs: 500, maxPolls: 20, timeoutMs: 8000, ...options };
    if (!Number.isSafeInteger(limits.maxPolls) || limits.maxPolls < 1 || limits.maxPolls > 100
      || !Number.isSafeInteger(limits.pollIntervalMs) || limits.pollIntervalMs < 1 || limits.pollIntervalMs > 60000
      || !Number.isSafeInteger(limits.timeoutMs) || limits.timeoutMs < 1 || limits.timeoutMs > 60000
      || typeof (options.sleep ?? (() => {})) !== "function") {
      throw new FiscalError("NOT_CONFIGURED", "Invalid bounded polling configuration");
    }
    const taxMap = assertTaxMap(options.taxMap);
    this.#o = {
      fetchImpl: globalThis.fetch, pollIntervalMs: 500, maxPolls: 20, timeoutMs: 8000,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)), ...options,
      taxMap,
      endpoints: { ...DEFAULT_ENDPOINTS, ...(options.endpoints ?? {}) },
    };
  }

  async #http(method, path, body) {
    const res = await this.#o.fetchImpl(new URL(path, this.#o.baseUrl), {
      method,
      headers: { "content-type": "application/json", ...(this.#token ? { authorization: `Bearer ${this.#token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.#o.timeoutMs),
    });
    let data = {};
    try { data = await res.json(); } catch { /* sin cuerpo */ }
    return { ok: res.ok, status: res.status, data };
  }

  async connect() {
    const r = await this.#http("POST", this.#o.endpoints.login, { username: this.#o.username, password: this.#o.password });
    if (!r.ok || typeof r.data.token !== "string") throw new FiscalError("DEVICE_AUTH_FAILED", "Cannot authenticate with device");
    this.#token = r.data.token;
    return { connected: true, simulated: true };
  }
  async disconnect() { this.#token = null; return { connected: false }; }
  async getStatus() {
    const r = await this.#http("GET", this.#o.endpoints.status);
    return { simulated: true, fiscal: false, connected: r.ok, deviceStatus: r.ok ? String(r.data.status ?? "ok") : "unreachable" };
  }

  async printReceipt(receipt) {
    if (!this.#token) throw new FiscalError("DEVICE_DISCONNECTED", "Not connected");
    // Todo se construye ANTES de enviar: un error de datos aquí es FAILED_BEFORE_SEND (sin riesgo fiscal).
    const doc = {
      type: "receipt", externalId: receipt.operationId,
      items: receipt.items.map((i) => ({
        name: i.name, quantity: (i.quantityMilli / 1000).toFixed(3), grossTotal: zl(i.grossTotalGrosz), ptu: taxLetter(i.taxCode, this.#o.taxMap),
      })),
      total: zl(receipt.totalGrosz),
    };
    let created;
    try { created = await this.#http("POST", this.#o.endpoints.command, doc); }
    catch { return { status: "unknown", operationId: receipt.operationId }; }
    if (!created.ok || !created.data.commandId) return { status: "unknown", operationId: receipt.operationId };
    const id = encodeURIComponent(String(created.data.commandId));

    // Desde aquí puede haberse impreso: cualquier fallo es "unknown".
    try {
      const confirm = await this.#http("PUT", `${this.#o.endpoints.command}/${id}/confirm`);
      if (!confirm.ok) return { status: "unknown", operationId: receipt.operationId };
      for (let i = 0; i < this.#o.maxPolls; i++) {
        const s = await this.#http("GET", `${this.#o.endpoints.command}/${id}`);
        if (!s.ok) return { status: "unknown", operationId: receipt.operationId };
        const state = String(s.data?.status ?? "").toLowerCase();
        if (state === "done") return { status: "confirmed", operationId: receipt.operationId, fiscal: false, simulated: true, fiscalNumber: s.data.receiptNumber ? String(s.data.receiptNumber) : undefined };
        if (state === "error") return { status: "unknown", operationId: receipt.operationId };
        await this.#o.sleep(this.#o.pollIntervalMs);
      }
    } catch { /* ambiguo */ }
    return { status: "unknown", operationId: receipt.operationId };
  }

  async reconcile(operationId) {
    const r = await this.#http("GET", `${this.#o.endpoints.command}?externalId=${encodeURIComponent(operationId)}`);
    if (!r.ok) return { status: "unknown", operationId };
    const state = String(r.data?.status ?? "").toLowerCase();
    if (state === "done") return { status: "confirmed", operationId, fiscal: false, simulated: true, fiscalNumber: r.data.receiptNumber ? String(r.data.receiptNumber) : undefined };
    if (state === "error" || state === "not_found") return { status: "unknown", operationId };
    return { status: "unknown", operationId };
  }
}
