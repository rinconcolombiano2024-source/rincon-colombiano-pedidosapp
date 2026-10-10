/**
 * Novitus online (NoviAPI, HTTP) — PROVISIONAL.
 * Flujo implementado: POST comando -> PUT confirmar -> GET sondeo, con token JWT.
 * Las rutas y campos son configurables y DEBEN contrastarse con la documentación oficial de NoviAPI
 * y probarse con una impresora real en modo de pruebas antes de usarlo.
 */
import { FiscalDriver, FiscalError } from "../../../fiscal-bridge/src/fiscal-contract.mjs";

const DEFAULT_ENDPOINTS = Object.freeze({ login: "/api/token", command: "/api/command", status: "/api/status" });
const DEFAULT_TAX_MAP = Object.freeze({ "23": "A", "8": "B", "5": "C", "0": "D", ZW: "E" });

export function taxLetter(taxCode, map = DEFAULT_TAX_MAP) {
  const raw = String(taxCode ?? "").trim().toUpperCase();
  if (/^[A-G]$/.test(raw)) return raw;
  const key = raw === "ZW" || raw === "EXEMPT" ? "ZW" : raw.replace(/[^0-9]/g, "");
  const letter = map[key];
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
    this.#o = {
      fetchImpl: globalThis.fetch, pollIntervalMs: 500, maxPolls: 20, timeoutMs: 8000,
      taxMap: DEFAULT_TAX_MAP, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), ...options,
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
    return { connected: r.ok, deviceStatus: r.ok ? String(r.data.status ?? "ok") : "unreachable" };
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
