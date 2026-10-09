
import test from "node:test";
import assert from "node:assert/strict";

import {
  PROVIDERS,
  evaluateIntegrationReadiness,
} from "../src/integration-readiness.mjs";

test("Supports five delivery platforms", () => {
  assert.equal(PROVIDERS.length, 5);
  assert.equal(PROVIDERS.includes("pyszne"), true);
});

test("Fiscal denies incomplete configuration", () => {
  const result = evaluateIntegrationReadiness({
    type: "fiscal",
    checks: {
      deviceRegistered: true,
    },
  });

  assert.equal(result.configured, false);
  assert.equal(result.operationAuthorized, false);
  assert.ok(result.missing.includes("agentAuthenticated"));
});

test("Delivery cannot bypass readiness", () => {
  for (const provider of PROVIDERS) {
    const result = evaluateIntegrationReadiness({
      type: "delivery",
      provider,
      checks: {},
    });

    assert.equal(result.configured, false);
    assert.equal(result.operationAuthorized, false);
  }
});

test("Payment requires complete validation", () => {
  const result = evaluateIntegrationReadiness({
    type: "payment",
    checks: {
      providerConfigured: true,
      webhookVerified: true,
    },
  });

  assert.equal(result.configured, false);
  assert.ok(result.missing.includes("refundsVerified"));
});

test("Readiness never grants authorization", () => {
  const result = evaluateIntegrationReadiness({
    type: "payment",
    checks: {
      providerConfigured: true,
      webhookVerified: true,
      checkoutVerified: true,
      idempotencyReady: true,
      reconciliationReady: true,
      refundsVerified: true,
    },
  });

  assert.equal(result.configured, true);
  assert.equal(result.operationAuthorized, false);
  assert.equal(result.status, "READY_FOR_AUTHORIZATION");
});

test("Rejects unknown delivery providers", () => {
  assert.throws(
    () => evaluateIntegrationReadiness({
      type: "delivery",
      provider: "unknown",
    }),
    { code: "INVALID_PROVIDER" }
  );
});
