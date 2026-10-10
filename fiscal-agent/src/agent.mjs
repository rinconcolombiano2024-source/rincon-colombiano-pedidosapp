/**
 * Agente fiscal local RC ORDERA.
 * Regla de oro: NUNCA se reimprime una operación cuyo resultado sea incierto.
 *   1) claim  2) journal "sending"  3) mark_sending (si falla, NO se imprime)  4) imprimir
 *   5) journal con resultado  6) reportar al servidor (reintentable sin reimprimir)
 */
import { randomBytes } from "node:crypto";
import { FiscalError, validateFiscalReceipt } from "../../fiscal-bridge/src/fiscal-contract.mjs";

export class MemoryJournal {
  #map = new Map();
  async list() { return [...this.#map.values()].map((v) => ({ ...v })); }
  async put(entry) { this.#map.set(entry.operationId, { ...entry }); }
  async remove(operationId) { this.#map.delete(operationId); }
}

const OUTCOMES = new Set(["confirmed", "failed", "unknown"]);

export class FiscalAgent {
  #client; #driver; #journal; #log; #newToken; #flight=null; #recovery=null;

  constructor({ client, driver, journal = new MemoryJournal(), log = () => {}, newToken = () => randomBytes(32).toString("hex") }) {
    if (!client || !driver) throw new FiscalError("INVALID_AGENT", "client and driver are required");
    this.#client = client; this.#driver = driver; this.#journal = journal; this.#log = log; this.#newToken = newToken;
  }

  /** Reporta resultados pendientes y recupera operaciones que quedaron a medias (caída durante la impresión). */
  async recover() {
    if(this.#flight){await this.#flight;return;}
    if(!this.#recovery)this.#recovery=this.#recover().finally(()=>{this.#recovery=null;});
    await this.#recovery;
  }
  async #recover() {
    for (const entry of await this.#journal.list()) {
      let { outcome, result } = entry;
      if (entry.phase === "sending") {
        outcome = "unknown"; result = { reason: "agent_restart_during_print" };
        const rec = await this.#tryReconcile(entry.operationId);
        if (rec) { outcome = rec.status; result = rec.result; }
      } else if (entry.phase === "unknown") {
        const rec = await this.#tryReconcile(entry.operationId);
        if (rec) { outcome = rec.status; result = rec.result; }
      }
      if (!OUTCOMES.has(outcome)) continue;
      const ok = await this.#report(entry, outcome, result);
      if (ok && outcome !== "unknown") await this.#journal.remove(entry.operationId);
      else await this.#journal.put({ ...entry, phase: outcome === "unknown" ? "unknown" : "reported_pending", outcome, result });
    }
  }

  async #tryReconcile(operationId) {
    try {
      const r = await this.#driver.reconcile(operationId);
      if (r && r.operationId === operationId && (r.status === "confirmed" || r.status === "failed")) return { status: r.status, result: pickResult(r) };
    } catch (error) { this.#log("reconcile_error", { operationId, code: error?.code }); }
    return null;
  }

  async #report(entry, outcome, result) {
    try {
      await this.#client.result(entry.operationId, entry.claimToken, outcome, result);
      return true;
    } catch (error) {
      this.#log("report_failed", { operationId: entry.operationId, code: error?.code });
      return false;
    }
  }

  /** Procesa como máximo una operación. Devuelve { idle: true } si no hay trabajo. */
  runOnce() {
    if(!this.#flight)this.#flight=this.#runOnce().finally(()=>{this.#flight=null;});
    return this.#flight;
  }
  async #runOnce() {
    if(this.#recovery)await this.#recovery;
    await this.#recover();

    const claimToken = this.#newToken();
    const claimed = await this.#client.claim(claimToken);
    if (!claimed) return { idle: true };

    const operationId = claimed.operation_id ?? claimed.operationId;
    const base = { operationId, claimToken };

    let receipt;
    try {
      receipt = validateFiscalReceipt({ ...claimed.fiscal_payload, operationId });
    } catch (error) {
      const result = { reason: "invalid_receipt", code: error?.code ?? "INVALID_RECEIPT" };
      await this.#journal.put({ ...base, phase: "sending" });
      try { await this.#client.sending(operationId, claimToken); }
      catch {
        await this.#journal.put({ ...base, phase: "unknown", outcome: "unknown", result: { reason: "sending_ack_lost_no_print" } });
        return { operationId, outcome: "skipped", printed: false };
      }
      await this.#journal.put({ ...base, phase: "result", outcome: "failed", result });
      if (await this.#report(base, "failed", result)) await this.#journal.remove(operationId);
      return { operationId, outcome: "failed", printed: false };
    }

    // Journal ANTES de transmitir; si mark_sending falla, no se imprime.
    await this.#journal.put({ ...base, phase: "sending" });
    try {
      await this.#client.sending(operationId, claimToken);
    } catch (error) {
      await this.#journal.put({ ...base, phase: "unknown", outcome: "unknown", result: { reason: "sending_ack_lost_no_print" } });
      this.#log("sending_rejected", { operationId, code: error?.code });
      return { operationId, outcome: "skipped", printed: false };
    }

    let outcome, result;
    try {
      const r = await this.#driver.printReceipt(receipt);
      outcome = r?.operationId === operationId && OUTCOMES.has(r?.status) ? r.status : "unknown";
      result = pickResult(r);
    } catch (error) {
      // Cualquier excepción tras empezar a transmitir es ambigua: nunca se reintenta la impresión.
      outcome = error?.code === "FAILED_BEFORE_SEND" ? "failed" : "unknown";
      result = { reason: error?.code ?? "driver_error" };
    }

    await this.#journal.put({ ...base, phase: outcome === "unknown" ? "unknown" : "result", outcome, result });
    const ok = await this.#report(base, outcome, result);
    if (ok && outcome !== "unknown") await this.#journal.remove(operationId);
    return { operationId, outcome, printed: outcome === "confirmed" ? true : outcome === "failed" ? false : null };
  }
}

function pickResult(r) {
  if (!r || typeof r !== "object") return {};
  const out = {};
  for (const k of ["fiscalNumber", "receiptNumber", "printedAt", "deviceStatus", "fiscal", "simulated", "alreadyProcessed"]) {
    if (r[k] !== undefined) out[k] = typeof r[k] === "string" ? r[k].slice(0, 200) : r[k];
  }
  return out;
}
