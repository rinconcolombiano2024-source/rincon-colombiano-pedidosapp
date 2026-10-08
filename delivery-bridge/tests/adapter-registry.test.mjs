
import test from "node:test";
import assert from "node:assert/strict";

import {
  DeliveryAdapterRegistry,
  createDefaultDeliveryRegistry,
} from "../src/adapter-registry.mjs";

function createTestAdapter() {
  return {
    async verify() {
      return false;
    },
    normalize() {
      throw new Error("TEST_ONLY");
    },
  };
}

test("No official providers enabled by default", () => {
  const registry = createDefaultDeliveryRegistry();

  assert.deepEqual(
    registry.supportedProviders(),
    []
  );

  for (const provider of [
    "glovo",
    "wolt",
    "uber_eats",
    "bolt_food",
  ]) {
    assert.throws(
      () => registry.create(provider),
      { code: "UNSUPPORTED_PROVIDER" }
    );
  }
});

test("Registers explicit test adapter", () => {
  const registry = new DeliveryAdapterRegistry();

  registry.register("rc_test", createTestAdapter);

  const adapter = registry.create("rc_test");

  assert.equal(typeof adapter.verify, "function");
  assert.equal(typeof adapter.normalize, "function");
});

test("Rejects duplicate adapters", () => {
  const registry = new DeliveryAdapterRegistry();

  registry.register("rc_test", createTestAdapter);

  assert.throws(
    () => registry.register(
      "rc_test",
      createTestAdapter
    ),
    { code: "DUPLICATE_PROVIDER" }
  );
});

test("Rejects malformed identifiers", () => {
  const registry = new DeliveryAdapterRegistry();

  for (const id of [
    "",
    "GLOVO",
    "../glovo",
    " glovo",
    "glovo ",
  ]) {
    assert.throws(
      () => registry.register(
        id,
        createTestAdapter
      ),
      { code: "INVALID_PROVIDER_ID" }
    );
  }
});

test("Rejects incomplete adapters", () => {
  const registry = new DeliveryAdapterRegistry();

  registry.register("invalid", () => ({
    verify() {
      return true;
    },
  }));

  assert.throws(
    () => registry.create("invalid"),
    { code: "INVALID_ADAPTER" }
  );
});

test("Registration does not start connections", () => {
  const registry = new DeliveryAdapterRegistry();
  let factoryCalls = 0;

  registry.register("rc_test", () => {
    factoryCalls++;
    return createTestAdapter();
  });

  assert.equal(factoryCalls, 0);

  registry.supportedProviders();

  assert.equal(factoryCalls, 0);

  registry.create("rc_test");

  assert.equal(factoryCalls, 1);
});
