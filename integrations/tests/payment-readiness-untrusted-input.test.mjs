import test from "node:test";
import assert from "node:assert/strict";
import {evaluateIntegrationReadiness, IntegrationReadinessError} from "../src/integration-readiness.mjs";

const allPaymentChecks = {
  providerConfigured: true,
  webhookVerified: true,
  checkoutVerified: true,
  idempotencyReady: true,
  reconciliationReady: true,
  refundsVerified: true,
};

test("payment readiness never grants authority to charge even with every check true", () => {
  const result = evaluateIntegrationReadiness({type: "payment", checks: allPaymentChecks});
  assert.equal(result.status, "READY_FOR_AUTHORIZATION");
  assert.equal(result.operationAuthorized, false);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.missing));
});

test("payment readiness requires every explicit own boolean true, not truthy values", () => {
  for (const [key] of Object.entries(allPaymentChecks)) {
    for (const value of [undefined, false, 1, "true", null]) {
      const checks = {...allPaymentChecks, [key]: value};
      const result = evaluateIntegrationReadiness({type: "payment", checks});
      assert.equal(result.status, "CONFIGURATION_INCOMPLETE", key);
      assert.equal(result.operationAuthorized, false, key);
      assert.ok(result.missing.includes(key), key);
    }
  }
});

test("prototype flags and getters cannot forge payment readiness", () => {
  const inherited = Object.create(allPaymentChecks);
  const inheritedResult = evaluateIntegrationReadiness({type: "payment", checks: inherited});
  assert.equal(inheritedResult.status, "CONFIGURATION_INCOMPLETE");
  assert.equal(inheritedResult.operationAuthorized, false);
  const checks = {...allPaymentChecks};
  let called = false;
  Object.defineProperty(checks, "webhookVerified", {enumerable: true, get() {
    called = true;
    throw new Error("untrusted getter must not execute");
  }});
  const result = evaluateIntegrationReadiness({type: "payment", checks});
  assert.equal(called, false);
  assert.equal(result.status, "CONFIGURATION_INCOMPLETE");
  assert.ok(result.missing.includes("webhookVerified"));
});

test("invalid readiness inputs fail closed", () => {
  for (const checks of [null, [], "ready", true]) {
    assert.throws(() => evaluateIntegrationReadiness({type: "payment", checks}),
      (error) => error instanceof IntegrationReadinessError && error.code === "INVALID_CHECKS");
  }
  assert.throws(() => evaluateIntegrationReadiness({type: "unknown", checks: {}}),
    (error) => error.code === "INVALID_TYPE");
  assert.throws(() => evaluateIntegrationReadiness({type: "delivery", provider: "unapproved", checks: {}}),
    (error) => error.code === "INVALID_PROVIDER");
});
