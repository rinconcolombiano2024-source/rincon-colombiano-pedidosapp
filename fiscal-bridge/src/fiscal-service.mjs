
import {
  FiscalError,
  validateFiscalReceipt,
} from "./fiscal-contract.mjs";

import {
  createDefaultFiscalRegistry,
} from "./driver-registry.mjs";

/**
 * RC ORDERA — Fiscal Service V1
 *
 * Local orchestration layer.
 * Does not connect to Supabase or issue legal receipts.
 * No cron, timers, polling or automatic retries.
 *
 * A production implementation must use durable,
 * server-side operation claims and reconciliation.
 */

export class FiscalService {
  #registry;
  #driver = null;
  #driverId = null;
  #busy = false;

  constructor(
    registry = createDefaultFiscalRegistry()
  ) {
    if (
      !registry ||
      typeof registry.create !== "function"
    ) {
      throw new FiscalError(
        "INVALID_REGISTRY",
        "A fiscal driver registry is required"
      );
    }

    this.#registry = registry;
  }

  async connect(driverId, options = {}) {
    if (this.#busy || this.#driver) {
      throw new FiscalError(
        "SERVICE_BUSY",
        "Fiscal service is busy or connected"
      );
    }

    this.#busy = true;

    try {
      const driver = this.#registry.create(
        driverId,
        options
      );

      const result = await driver.connect();

      if (result?.connected !== true) {
        throw new FiscalError(
          "CONNECTION_NOT_CONFIRMED",
          "Device connection was not confirmed"
        );
      }

      this.#driver = driver;
      this.#driverId = driverId;

      return {
        connected: true,
        driverId,
        simulated: result.simulated === true,
      };
    } finally {
      this.#busy = false;
    }
  }

  async getStatus() {
    if (!this.#driver) {
      return {
        connected: false,
        driverId: null,
      };
    }

    return this.#driver.getStatus();
  }

  async simulateReceipt(input) {
    if (
      this.#busy ||
      !this.#driver ||
      this.#driverId !== "mock"
    ) {
      throw new FiscalError(
        "SIMULATION_NOT_AVAILABLE",
        "Connect the mock driver first"
      );
    }

    const receipt = validateFiscalReceipt(input);

    this.#busy = true;

    try {
      const result =
        await this.#driver.printReceipt(receipt);

      if (
        !result ||
        result.simulated !== true ||
        result.fiscal !== false
      ) {
        throw new FiscalError(
          "INVALID_SIMULATION_RESPONSE",
          "Unexpected simulator response"
        );
      }

      return result;
    } finally {
      this.#busy = false;
    }
  }

  async disconnect() {
    if (this.#busy) {
      throw new FiscalError(
        "SERVICE_BUSY",
        "Cannot disconnect during an operation"
      );
    }

    if (!this.#driver) {
      return {
        connected: false,
      };
    }

    this.#busy = true;

    try {
      const result =
        await this.#driver.disconnect();

      if (result?.connected !== false) {
        throw new FiscalError(
          "DISCONNECT_NOT_CONFIRMED",
          "Device disconnection was not confirmed"
        );
      }

      this.#driver = null;
      this.#driverId = null;

      return result;
    } finally {
      this.#busy = false;
    }
  }
}
