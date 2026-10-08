
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

class TestDeviceDriver extends FiscalDriver {
  async connect() {
    return { connected: true, simulated: true };
  }

  async getStatus() {
    return { connected: false, simulated: true };
  }

  async printReceipt() {
    throw new FiscalError(
      "TEST_DEVICE_NO_PRINT",
      "Physical printing disabled"
    );
  }

  async reconcile() {
    return { status: "unknown", simulated: true };
  }

  async disconnect() {
    return { connected: false, simulated: true };
  }
}

test("Default registry only supports mock", () => {
  const registry = createDefaultFiscalRegistry();

  assert.deepEqual(
    registry.supportedDrivers(),
    ["mock"]
  );
});

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
      { code: "UNSUPPORTED_FISCAL_DEVICE" }
    );
  }
});

test("Mock is created without connection", async () => {
  const registry = createDefaultFiscalRegistry();
  const driver = registry.create("mock");

  assert.ok(driver instanceof MockFiscalDriver);

  const status = await driver.getStatus();

  assert.equal(status.connected, false);
  assert.equal(status.simulated, true);
  assert.equal(status.issuedCount, 0);
});

test("Reject invalid driver identifiers", () => {
  const registry = new FiscalDriverRegistry();

  for (const id of [
    "",
    "POSNET",
    "../posnet",
    " posnet",
    "posnet ",
  ]) {
    assert.throws(
      () => registry.register(
        id,
        () => new TestDeviceDriver()
      ),
      { code: "INVALID_DRIVER_ID" }
    );
  }
});

test("Reject non-function factories", () => {
  const registry = new FiscalDriverRegistry();

  assert.throws(
    () => registry.register("device", {}),
    { code: "INVALID_DRIVER_FACTORY" }
  );
});

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
    { code: "DUPLICATE_DRIVER" }
  );
});

test("Reject drivers without fiscal contract", () => {
  const registry = new FiscalDriverRegistry();

  registry.register("invalid", () => ({
    connect() {},
  }));

  assert.throws(
    () => registry.create("invalid"),
    { code: "INVALID_DRIVER" }
  );
});

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
    { code: "TEST_DEVICE_NO_PRINT" }
  );
});

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
