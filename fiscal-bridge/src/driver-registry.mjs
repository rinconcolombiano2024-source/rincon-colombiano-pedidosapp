
import {
  FiscalDriver,
  FiscalError,
} from "./fiscal-contract.mjs";

import {
  MockFiscalDriver,
} from "./mock-driver.mjs";

/**
 * RC ORDERA — Fiscal Driver Registry V1.1
 *
 * Central registry for fiscal device adapters.
 *
 * SECURITY:
 * - Explicit driver registration
 * - Strict driver identifier validation
 * - Duplicate registration protection
 * - Required fiscal contract verification
 * - Reject inherited unimplemented methods
 * - Unknown devices fail closed
 * - No automatic physical printing
 *
 * PERFORMANCE:
 * - Lazy driver instantiation
 * - No polling
 * - No timers
 * - No background processes
 * - No automatic connections
 *
 * IMPORTANT:
 * Registering a driver does not authorize
 * fiscal issuance or certify hardware.
 *
 * Real fiscal devices require approved protocols,
 * secure authorization and durable reconciliation.
 */

const DRIVER_ID_PATTERN =
  /^[a-z][a-z0-9_-]{1,63}$/;

const REQUIRED_METHODS = Object.freeze([
  "connect",
  "getStatus",
  "printReceipt",
  "reconcile",
  "disconnect",
]);

export class FiscalDriverRegistry {
  #factories = new Map();

  /**
   * Register a fiscal device factory.
   *
   * Registration is explicit and does not
   * instantiate or connect the driver.
   */
  register(driverId, factory) {
    if (
      typeof driverId !== "string" ||
      !DRIVER_ID_PATTERN.test(driverId)
    ) {
      throw new FiscalError(
        "INVALID_DRIVER_ID",
        "Invalid fiscal driver identifier"
      );
    }

    if (typeof factory !== "function") {
      throw new FiscalError(
        "INVALID_DRIVER_FACTORY",
        "Driver factory must be a function"
      );
    }

    if (this.#factories.has(driverId)) {
      throw new FiscalError(
        "DUPLICATE_DRIVER",
        "Driver already registered"
      );
    }

    this.#factories.set(driverId, factory);
  }

  /**
   * Create an explicitly registered driver.
   *
   * Does not connect to hardware.
   * Does not authorize printing.
   */
  create(driverId, options = {}) {
    const factory = this.#factories.get(driverId);

    if (!factory) {
      throw new FiscalError(
        "UNSUPPORTED_FISCAL_DEVICE",
        "No fiscal adapter registered"
      );
    }

    const driver = factory(options);

    if (!(driver instanceof FiscalDriver)) {
      throw new FiscalError(
        "INVALID_DRIVER",
        "Adapter must extend FiscalDriver"
      );
    }

    /**
     * Validate that the driver implements
     * every required fiscal operation.
     *
     * Methods inherited unchanged from
     * FiscalDriver are not implementations.
     */
    for (const method of REQUIRED_METHODS) {
      if (
        typeof driver[method] !== "function" ||
        driver[method] === FiscalDriver.prototype[method]
      ) {
        throw new FiscalError(
          "INVALID_DRIVER",
          `Fiscal driver must implement ${method}()`
        );
      }
    }

    return driver;
  }

  /**
   * Return registered driver identifiers.
   *
   * This does not indicate that devices
   * are connected, configured or certified.
   */
  supportedDrivers() {
    return [...this.#factories.keys()];
  }
}

/**
 * Default RC ORDERA fiscal registry.
 *
 * Only mock simulation is available.
 *
 * Real fiscal devices must be registered
 * through explicitly reviewed adapters.
 */
export function createDefaultFiscalRegistry() {
  const registry = new FiscalDriverRegistry();

  registry.register(
    "mock",
    options => new MockFiscalDriver(options)
  );

  return registry;
}
