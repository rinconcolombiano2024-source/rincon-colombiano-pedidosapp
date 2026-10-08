
import {
  FiscalError,
  validateFiscalReceipt,
} from "./fiscal-contract.mjs";

import {
  createDefaultFiscalRegistry,
} from "./driver-registry.mjs";

/**
 * RC ORDERA — Fiscal Service V1.2
 *
 * Universal fiscal-driver orchestration.
 *
 * Security:
 * - Explicit driver selection
 * - Cleanup on failed connection
 * - No automatic physical printing
 * - No polling, timers or background retries
 * - Mock-only receipt simulation
 * - Fail-closed on uncertain device state
 * - Strict fiscal reconciliation identity validation
 * - Reject inconsistent simulator responses
 *
 * Real fiscal issuance requires durable server-side
 * claims, authorized hardware drivers and reconciliation.
 *
 * IMPORTANT:
 * This service does not issue real fiscal receipts.
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
        "Service is busy or already connected"
      );
    }

    this.#busy = true;
    let driver = null;

    try {
      driver = this.#registry.create(
        driverId,
        options
      );

      const result = await driver.connect();

      if (result?.connected !== true) {
        throw new FiscalError(
          "CONNECTION_NOT_CONFIRMED",
          "Device did not confirm connection"
        );
      }

      this.#driver = driver;
      this.#driverId = driverId;

      return {
        connected: true,
        driverId,
        simulated: result.simulated === true,
      };

    } catch (error) {
      if (driver) {
        try {
          const cleanup = await driver.disconnect();

          if (cleanup?.connected !== false) {
            this.#driver = driver;
            this.#driverId = driverId;

            throw new FiscalError(
              "DEVICE_CLEANUP_UNCONFIRMED",
              "Cleanup was not confirmed"
            );
          }

        } catch (cleanupError) {
          this.#driver = driver;
          this.#driverId = driverId;

          throw new FiscalError(
            "DEVICE_CLEANUP_UNCONFIRMED",
            "Connection failed and cleanup is uncertain"
          );
        }
      }

      throw error;

    } finally {
      this.#busy = false;
    }
  }

  async getStatus() {
    if (this.#busy) {
      throw new FiscalError(
        "SERVICE_BUSY",
        "Device operation in progress"
      );
    }

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
        "Connect mock driver first"
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
        !["confirmed", "failed", "unknown"].includes(
          result.status
        ) ||
        result.fiscal === true ||
        (
          result.status === "confirmed" &&
          result.fiscal !== false
        )
      ) {
        throw new FiscalError(
          "INVALID_SIMULATION_RESPONSE",
          "Unexpected simulator response"
        );
      }

      return {
        ...result,
        simulated: true,
        fiscal: false,
      };

    } finally {
      this.#busy = false;
    }
  }

  async reconcileSimulation(operationId) {
    if (
      this.#busy ||
      !this.#driver ||
      this.#driverId !== "mock"
    ) {
      throw new FiscalError(
        "RECONCILIATION_NOT_AVAILABLE",
        "Mock driver must be connected and idle"
      );
    }

    this.#busy = true;

    try {
      const result =
        await this.#driver.reconcile(operationId);

      /*
       * SECURITY HARDENING V1.2
       *
       * Never accept reconciliation for a different
       * operation.
       *
       * Never accept real fiscal issuance from mock.
       *
       * Never trust malformed driver responses.
       */

      if (
        !result ||
        result.operationId !== operationId ||
        result.simulated !== true ||
        result.fiscal === true ||
        !["confirmed", "failed", "unknown"].includes(
          result.status
        ) ||
        (
          result.status === "confirmed" &&
          result.fiscal !== false
        )
      ) {
        throw new FiscalError(
          "INVALID_RECONCILIATION_RESULT",
          "Invalid or mismatched simulator reconciliation response"
        );
      }

      return {
        ...result,
        simulated: true,
        fiscal: false,
      };

    } finally {
      this.#busy = false;
    }
  }

  async disconnect() {
    if (this.#busy) {
      throw new FiscalError(
        "SERVICE_BUSY",
        "Cannot disconnect during operation"
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
          "Device disconnection is uncertain"
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
