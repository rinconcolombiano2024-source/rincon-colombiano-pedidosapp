
/**
 * RC ORDERA — MOCK FISCAL DRIVER V1
 *
 * SIMULADOR PARA PRUEBAS.
 * NO UTILIZAR PARA EMISION FISCAL REAL.
 *
 * No conecta con POSNET.
 * No transmite comandos fiscales.
 * No genera comprobantes legales.
 * No confirma ventas ante la autoridad fiscal.
 */

import {
  FiscalDriver,
  FiscalError,
  requireUuid,
  validateFiscalReceipt,
} from "./fiscal-contract.mjs";

const OUTCOMES = Object.freeze({
  SUCCESS: "success",
  REJECTED: "rejected",
  UNKNOWN_BEFORE: "unknown_before",
  UNKNOWN_AFTER: "unknown_after",
});

const allowedOutcomes = new Set(
  Object.values(OUTCOMES)
);

function snapshot(value) {
  return structuredClone(value);
}

function receiptFingerprint(receipt) {
  return JSON.stringify(receipt);
}

export class MockFiscalDriver extends FiscalDriver {
  #connected = false;
  #busy = false;
  #records = new Map();
  #nextOutcome = OUTCOMES.SUCCESS;
  #sequence = 0;
  #issuedCount = 0;

  constructor(options = {}) {
    super();

    if (
      options === null ||
      typeof options !== "object" ||
      Array.isArray(options)
    ) {
      throw new FiscalError(
        "INVALID_OPTIONS",
        "Invalid mock options"
      );
    }

    this.deviceId =
      options.deviceId || "RC-MOCK-FISCAL-001";

    if (
      typeof this.deviceId !== "string" ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(this.deviceId)
    ) {
      throw new FiscalError(
        "INVALID_DEVICE",
        "Invalid mock device identifier"
      );
    }
  }

  async connect() {
    if (this.#busy) {
      throw new FiscalError(
        "DEVICE_BUSY",
        "Device is busy"
      );
    }

    this.#connected = true;

    return {
      connected: true,
      deviceId: this.deviceId,
      simulated: true,
    };
  }

  async disconnect() {
    if (this.#busy) {
      throw new FiscalError(
        "DEVICE_BUSY",
        "Cannot disconnect during operation"
      );
    }

    this.#connected = false;

    return {
      connected: false,
      simulated: true,
    };
  }

  async getStatus() {
    return {
      connected: this.#connected,
      busy: this.#busy,
      simulated: true,
      fiscal: false,
      deviceId: this.deviceId,
      issuedCount: this.#issuedCount,
    };
  }

  setNextOutcome(outcome) {
    if (!allowedOutcomes.has(outcome)) {
      throw new FiscalError(
        "INVALID_OUTCOME",
        "Unsupported simulated outcome"
      );
    }

    if (this.#busy) {
      throw new FiscalError(
        "DEVICE_BUSY",
        "Cannot change outcome while busy"
      );
    }

    this.#nextOutcome = outcome;
  }

  async printReceipt(input) {
    if (!this.#connected) {
      throw new FiscalError(
        "DEVICE_DISCONNECTED",
        "Mock printer is disconnected"
      );
    }

    if (this.#busy) {
      throw new FiscalError(
        "DEVICE_BUSY",
        "Mock printer is processing another sale"
      );
    }

    const receipt = validateFiscalReceipt(input);
    const fingerprint = receiptFingerprint(receipt);

    const previous = this.#records.get(
      receipt.operationId
    );

    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new FiscalError(
          "OPERATION_CONFLICT",
          "Operation ID reused with different data"
        );
      }

      if (previous.status === "confirmed") {
        return {
          ...snapshot(previous.result),
          alreadyProcessed: true,
        };
      }

      throw new FiscalError(
        "OPERATION_REQUIRES_RECONCILIATION",
        "Operation exists and cannot be resent"
      );
    }

    this.#busy = true;

    const outcome = this.#nextOutcome;
    this.#nextOutcome = OUTCOMES.SUCCESS;

    try {
      const record = {
        fingerprint,
        receipt: snapshot(receipt),
        status: "unknown",
        emitted: false,
        result: null,
      };

      // Registrar antes de simular cualquier envio.
      this.#records.set(
        receipt.operationId,
        record
      );

      if (outcome === OUTCOMES.REJECTED) {
        record.status = "failed";

        record.result = {
          operationId: receipt.operationId,
          status: "failed",
          simulated: true,
          emitted: false,
          reason: "SIMULATED_REJECTION",
        };

        return snapshot(record.result);
      }

      if (outcome === OUTCOMES.UNKNOWN_BEFORE) {
        record.status = "unknown";

        record.result = {
          operationId: receipt.operationId,
          status: "unknown",
          simulated: true,
          reason: "SIMULATED_INTERRUPTION",
        };

        return snapshot(record.result);
      }

      // Simulamos una emision aceptada.
      this.#sequence += 1;
      this.#issuedCount += 1;

      record.emitted = true;

      const confirmation = {
        operationId: receipt.operationId,
        status: "confirmed",
        simulated: true,
        fiscal: false,
        deviceId: this.deviceId,
        mockReceiptNumber: this.#sequence,
        totalGrosz: receipt.totalGrosz,
      };

      if (outcome === OUTCOMES.UNKNOWN_AFTER) {
        record.status = "unknown";
        record.result = confirmation;

        return {
          operationId: receipt.operationId,
          status: "unknown",
          simulated: true,
          reason: "SIMULATED_LOST_ACK",
        };
      }

      record.status = "confirmed";
      record.result = confirmation;

      return snapshot(confirmation);
    } finally {
      this.#busy = false;
    }
  }

  async reconcile(operationId) {
    const id = requireUuid(
      operationId,
      "operationId"
    );

    if (!this.#connected) {
      throw new FiscalError(
        "DEVICE_DISCONNECTED",
        "Reconciliation requires connection"
      );
    }

    if (this.#busy) {
      throw new FiscalError(
        "DEVICE_BUSY",
        "Reconciliation unavailable while busy"
      );
    }

    const record = this.#records.get(id);

    if (!record) {
      return {
        operationId: id,
        status: "unknown",
        simulated: true,
        reason: "NO_LOCAL_RECORD",
      };
    }

    if (
      record.status === "unknown" &&
      record.emitted === true
    ) {
      record.status = "confirmed";
    }

    if (
      record.status === "unknown" &&
      record.emitted === false
    ) {
      // Se conserva UNKNOWN por seguridad.
      // Ausencia de registro no es prueba
      // suficiente para declarar una falla.
      return {
        operationId: id,
        status: "unknown",
        simulated: true,
        reason: "EMISSION_NOT_VERIFIED",
      };
    }

    return snapshot(record.result);
  }

  /**
   * Util exclusivamente para pruebas.
   */
  getDiagnostics() {
    return {
      simulated: true,
      connected: this.#connected,
      busy: this.#busy,
      operationCount: this.#records.size,
      issuedCount: this.#issuedCount,
    };
  }
}

export { OUTCOMES as MOCK_FISCAL_OUTCOMES };
