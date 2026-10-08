
import {
  FiscalDriver,
  FiscalError,
} from "./fiscal-contract.mjs";

import {
  MockFiscalDriver,
} from "./mock-driver.mjs";

/**
 * RC ORDERA — Fiscal Driver Registry V1
 *
 * Explicit drivers only.
 * Unknown hardware fails closed.
 * No automatic physical printing.
 */

export class FiscalDriverRegistry {
  #factories = new Map();

  register(driverId, factory) {
    if (
      typeof driverId !== "string" ||
      !/^[a-z][a-z0-9_-]{1,63}$/.test(driverId)
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

  create(driverId, options = {}) {
    const factory = this.#factories.get(driverId);

    if (!factory) {
      throw new FiscalError(
        "UNSUPPORTED_FISCAL_DEVICE",
        "No certified adapter registered"
      );
    }

    const driver = factory(options);

    if (!(driver instanceof FiscalDriver)) {
      throw new FiscalError(
        "INVALID_DRIVER",
        "Adapter must extend FiscalDriver"
      );
    }

    return driver;
  }

  supportedDrivers() {
    return [...this.#factories.keys()];
  }
}

export function createDefaultFiscalRegistry() {
  const registry = new FiscalDriverRegistry();

  registry.register(
    "mock",
    options => new MockFiscalDriver(options)
  );

  return registry;
}
