
import {
  FiscalError,
  requireUuid,
  validateFiscalReceipt,
} from "./fiscal-contract.mjs";

import {
  createDefaultFiscalRegistry,
} from "./driver-registry.mjs";

/**
 * RC ORDERA — Fiscal Service V1.5
 *
 * Universal fiscal-driver orchestration.
 *
 * SECURITY:
 * - Explicit driver selection
 * - Cleanup on failed connection
 * - No automatic physical printing
 * - No polling or background retries
 * - Mock-only receipt simulation
 * - Single operation at a time, including status reads
 * - Fail-closed on uncertain device state
 * - Strict operation identity validation
 * - Reject inconsistent driver responses
 * - Validate reconciliation UUID before driver calls
 *
 * COMPATIBILITY:
 * - Preserves FiscalService V1.4 public API
 * - Compatible with existing mock driver
 * - No database changes
 * - No network requests
 * - No CPU-intensive background operations
 *
 * IMPORTANT:
 * This service never issues legal fiscal receipts.
 * Physical fiscal hardware requires an authorized
 * adapter, durable claims and reconciliation.
 */

const VALID_RESULTS = new Set([
  "confirmed",
  "failed",
  "unknown",
]);

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

  /**
   * Connect explicitly to a registered driver.
   *
   * No automatic reconnection is performed.
   */
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
          const cleanup =
            await driver.disconnect();

          if (cleanup?.connected !== false) {
            this.#driver = driver;
            this.#driverId = driverId;

            throw new FiscalError(
              "DEVICE_CLEANUP_UNCONFIRMED",
              "Cleanup was not confirmed"
            );
          }

        } catch {
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

  /**
   * Read current driver status.
   *
   * Serialized with connect, disconnect and
   * simulation/reconciliation operations.
   *
   * The lock is always released, including errors.
   *
   * No polling or automatic refresh.
   */
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

    this.#busy = true;

    try {
      return await this.#driver.getStatus();
    } finally {
      this.#busy = false;
    }
  }

  /**
   * Simulate a fiscal receipt.
   *
   * Never sends commands to physical hardware.
   *
   * The returned operationId MUST match the
   * validated input operationId.
   */
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
        typeof result !== "object" ||
        Array.isArray(result) ||
        result.operationId !== receipt.operationId ||
        result.simulated !== true ||
        !VALID_RESULTS.has(result.status) ||
        result.fiscal === true ||
        (
          result.status === "confirmed" &&
          result.fiscal !== false
        )
      ) {
        throw new FiscalError(
          "INVALID_SIMULATION_RESPONSE",
          "Invalid or mismatched simulator response"
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

  /**
   * Reconcile a simulated fiscal operation.
   *
   * UNKNOWN is never automatically retried
   * or assumed to be FAILED.
   *
   * The driver's result MUST reference the
   * exact operation requested.
   *
   * V1.5:
   * UUID validation occurs before accessing
   * the driver.
   *
   * Invalid identifiers cannot reach
   * the fiscal adapter.
   */
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

    const validatedOperationId = requireUuid(
      operationId,
      "operationId"
    );

    this.#busy = true;

    try {
      const result =
        await this.#driver.reconcile(
          validatedOperationId
        );

      if (
        !result ||
        typeof result !== "object" ||
        Array.isArray(result) ||
        result.operationId !== validatedOperationId ||
        result.simulated !== true ||
        !VALID_RESULTS.has(result.status) ||
        result.fiscal === true ||
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

  /**
   * Disconnect the current driver.
   *
   * A failed or uncertain disconnection keeps
   * the driver registered to prevent unsafe reuse.
   */
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
