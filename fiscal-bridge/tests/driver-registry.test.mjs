
import test from "node:test";
import assert from "node:assert/strict";

import {
  FiscalDriver,
  FiscalError,
} from "../src/fiscal-contract.mjs";

import {
  FiscalDriverRegistry,
  createDefaultFiscalRegistry,
} from "../src/driver-registry.mjs";

import {
  MockFiscalDriver,
} from "../src/mock-driver.mjs";

/**
 * RC ORDERA — FISCAL DRIVER REGISTRY TESTS V1.1
 *
 * Compatible with FiscalDriverRegistry V1.1.
 *
 * SECURITY:
 * - Explicit registration
 * - Unknown hardware fails closed
 * - Duplicate protection
 * - Strict identifier validation
 * - Contract implementation validation
 * - Inherited abstract method rejection
 * - No automatic device connections
 * - No physical fiscal printing
 *
 * PERFORMANCE:
 * - Lazy initialization
 * - No polling
 * - No timers
 * - No background jobs
 *
 * TESTS ONLY.
 * No legal fiscal receipts are issued.
 */

class TestDeviceDriver extends FiscalDriver {
  async connect() {
    return {
      connected: true,
      simulated: true,
    };
  }

  async getStatus() {
    return {
      connected: false,
      simulated: true,
    };
  }

  async printReceipt() {
    throw new FiscalError(
      "TEST_DEVICE_NO_PRINT",
      "Physical printing disabled"
    );
  }

  async reconcile() {
    return {
      status: "unknown",
      simulated: true,
    };
  }

  async disconnect() {
    return {
      connected: false,
      simulated: true,
    };
  }
}

// ----------------------------------------------------------
// 1. Default registry
// ----------------------------------------------------------

test("Default registry only supports mock", () => {
  const registry = createDefaultFiscalRegistry();

  assert.deepEqual(
    registry.supportedDrivers(),
    ["mock"]
  );
});

// ----------------------------------------------------------
// 2. Unknown physical hardware
// ----------------------------------------------------------

test("Unknown physical devices fail closed", () => {
  const registry = createDefaultFiscalRegistry();

  for (const id of [
    "posnet",
    "novitus",
    "elzab",
    "unknown",
  ]) {
    assert.throws(
      () => registry.create(id),
      {
        code: "UNSUPPORTED_FISCAL_DEVICE",
      }
    );
  }
});

// ----------------------------------------------------------
// 3. Mock initialization
// ----------------------------------------------------------

test("Mock is created without connection", async () => {
  const registry = createDefaultFiscalRegistry();

  const driver = registry.create("mock");

  assert.ok(driver instanceof MockFiscalDriver);

  const status = await driver.getStatus();

  assert.equal(status.connected, false);
  assert.equal(status.simulated, true);
  assert.equal(status.issuedCount, 0);
});

// ----------------------------------------------------------
// 4. Invalid identifiers
// ----------------------------------------------------------

test("Reject invalid driver identifiers", () => {
  const registry = new FiscalDriverRegistry();

  for (const id of [
    "",
    "POSNET",
    "../posnet",
    " posnet",
    "posnet ",
    "device.name",
    "device/name",
    null,
    undefined,
    123,
  ]) {
    assert.throws(
      () => registry.register(
        id,
        () => new TestDeviceDriver()
      ),
      {
        code: "INVALID_DRIVER_ID",
      }
    );
  }
});

// ----------------------------------------------------------
// 5. Invalid factories
// ----------------------------------------------------------

test("Reject non-function factories", () => {
  const registry = new FiscalDriverRegistry();

  for (const factory of [
    null,
    undefined,
    {},
    [],
    "factory",
    123,
  ]) {
    assert.throws(
      () => registry.register(
        "device",
        factory
      ),
      {
        code: "INVALID_DRIVER_FACTORY",
      }
    );
  }
});

// ----------------------------------------------------------
// 6. Duplicate registration
// ----------------------------------------------------------

test("Reject duplicate registration", () => {
  const registry = new FiscalDriverRegistry();

  registry.register(
    "test_device",
    () => new TestDeviceDriver()
  );

  assert.throws(
    () => registry.register(
      "test_device",
      () => new TestDeviceDriver()
    ),
    {
      code: "DUPLICATE_DRIVER",
    }
  );

  assert.deepEqual(
    registry.supportedDrivers(),
    ["test_device"]
  );
});

// ----------------------------------------------------------
// 7. Invalid fiscal contract
// ----------------------------------------------------------

test("Reject drivers without fiscal contract", () => {
  const registry = new FiscalDriverRegistry();

  registry.register("invalid", () => ({
    connect() {},
  }));

  assert.throws(
    () => registry.create("invalid"),
    {
      code: "INVALID_DRIVER",
    }
  );
});

// ----------------------------------------------------------
// 8. Valid registered driver
// ----------------------------------------------------------

test("Registered driver respects interface", async () => {
  const registry = new FiscalDriverRegistry();

  registry.register(
    "test_device",
    () => new TestDeviceDriver()
  );

  const driver = registry.create("test_device");

  assert.ok(driver instanceof FiscalDriver);

  await assert.rejects(
    driver.printReceipt({}),
    {
      code: "TEST_DEVICE_NO_PRINT",
    }
  );
});

// ----------------------------------------------------------
// 9. Lazy initialization
// ----------------------------------------------------------

test("Registry creation is lazy", () => {
  const registry = new FiscalDriverRegistry();

  let created = 0;

  registry.register("lazy_device", () => {
    created += 1;
    return new TestDeviceDriver();
  });

  assert.equal(created, 0);

  registry.supportedDrivers();

  assert.equal(created, 0);

  registry.create("lazy_device");

  assert.equal(created, 1);
});

// ----------------------------------------------------------
// 10. Reject inherited unimplemented methods
// ----------------------------------------------------------

test("Reject inherited unimplemented fiscal methods", () => {
  class IncompleteFiscalDriver extends FiscalDriver {
    async connect() {
      return { connected: true };
    }

    async disconnect() {
      return { connected: false };
    }
  }

  const registry = new FiscalDriverRegistry();

  registry.register(
    "incomplete",
    () => new IncompleteFiscalDriver()
  );

  assert.throws(
    () => registry.create("incomplete"),
    {
      code: "INVALID_DRIVER",
    }
  );
});

// ----------------------------------------------------------
// 11. Reject completely abstract driver
// ----------------------------------------------------------

test("Reject direct FiscalDriver instance", () => {
  const registry = new FiscalDriverRegistry();

  registry.register(
    "abstract_driver",
    () => new FiscalDriver()
  );

  assert.throws(
    () => registry.create("abstract_driver"),
    {
      code: "INVALID_DRIVER",
    }
  );
});

// ----------------------------------------------------------
// 12. Check all required methods independently
// ----------------------------------------------------------

test("Reject each missing fiscal method independently", () => {
  const requiredMethods = [
    "connect",
    "getStatus",
    "printReceipt",
    "reconcile",
    "disconnect",
  ];

  for (const missingMethod of requiredMethods) {
    class PartiallyImplementedDriver extends FiscalDriver {
      async connect() {
        return { connected: true };
      }

      async getStatus() {
        return { connected: false };
      }

      async printReceipt() {
        return {
          status: "unknown",
          simulated: true,
          fiscal: false,
        };
      }

      async reconcile() {
        return {
          status: "unknown",
          simulated: true,
          fiscal: false,
        };
      }

      async disconnect() {
        return { connected: false };
      }
    }

    // Restore one abstract method intentionally.
    Object.defineProperty(
      PartiallyImplementedDriver.prototype,
      missingMethod,
      {
        value: FiscalDriver.prototype[missingMethod],
        configurable: true,
        writable: true,
      }
    );

    const registry = new FiscalDriverRegistry();

    registry.register(
      "partial_device",
      () => new PartiallyImplementedDriver()
    );

    assert.throws(
      () => registry.create("partial_device"),
      {
        code: "INVALID_DRIVER",
      },
      `Expected rejection for ${missingMethod}`
    );
  }
});

// ----------------------------------------------------------
// 13. Factory must return an actual driver
// ----------------------------------------------------------

test("Reject factories returning invalid values", () => {
  const invalidValues = [
    null,
    undefined,
    {},
    [],
    true,
    123,
    "driver",
  ];

  for (const value of invalidValues) {
    const registry = new FiscalDriverRegistry();

    registry.register(
      "invalid_factory_result",
      () => value
    );

    assert.throws(
      () => registry.create(
        "invalid_factory_result"
      ),
      {
        code: "INVALID_DRIVER",
      }
    );
  }
});

// ----------------------------------------------------------
// 14. Registration must not instantiate drivers
// ----------------------------------------------------------

test("Registering a factory never creates a driver", () => {
  const registry = new FiscalDriverRegistry();

  let factoryCalls = 0;

  registry.register(
    "controlled_device",
    () => {
      factoryCalls++;

      return new TestDeviceDriver();
    }
  );

  assert.equal(factoryCalls, 0);

  assert.deepEqual(
    registry.supportedDrivers(),
    ["controlled_device"]
  );

  assert.equal(factoryCalls, 0);
});

// ----------------------------------------------------------
// 15. Unknown devices must not execute factories
// ----------------------------------------------------------

test("Unknown driver lookup never executes a factory", () => {
  const registry = new FiscalDriverRegistry();

  let factoryCalls = 0;

  registry.register(
    "known_device",
    () => {
      factoryCalls++;
      return new TestDeviceDriver();
    }
  );

  assert.throws(
    () => registry.create("unknown_device"),
    {
      code: "UNSUPPORTED_FISCAL_DEVICE",
    }
  );

  assert.equal(factoryCalls, 0);
});

// ----------------------------------------------------------
// 16. Registry instances remain isolated
// ----------------------------------------------------------

test("Fiscal registries have isolated registrations", () => {
  const first = new FiscalDriverRegistry();
  const second = new FiscalDriverRegistry();

  first.register(
    "isolated_device",
    () => new TestDeviceDriver()
  );

  assert.deepEqual(
    first.supportedDrivers(),
    ["isolated_device"]
  );

  assert.deepEqual(
    second.supportedDrivers(),
    []
  );

  assert.throws(
    () => second.create("isolated_device"),
    {
      code: "UNSUPPORTED_FISCAL_DEVICE",
    }
  );
});
