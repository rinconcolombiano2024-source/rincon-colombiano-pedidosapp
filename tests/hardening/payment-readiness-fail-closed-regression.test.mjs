import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateIntegrationReadiness } from '../../integrations/src/integration-readiness.mjs';

const required = [
  'providerConfigured', 'webhookVerified', 'checkoutVerified',
  'idempotencyReady', 'reconciliationReady', 'refundsVerified'
];

test('payment readiness fails closed for missing, falsy, and truthy non-boolean checks', () => {
  for (const field of required) {
    for (const value of [undefined, false, null, 0, 1, 'true', 'false', {}, []]) {
      const checks = Object.fromEntries(required.map(key => [key, true]));
      checks[field] = value;
      const result = evaluateIntegrationReadiness({ type: 'payment', checks });
      assert.equal(result.configured, false, field + ': ' + String(value));
      assert.equal(result.status, 'CONFIGURATION_INCOMPLETE');
      assert.equal(result.operationAuthorized, false);
      assert.ok(result.missing.includes(field));
    }
  }
});

test('all payment checks passing never grants permission to charge', () => {
  const checks = Object.fromEntries(required.map(key => [key, true]));
  const result = evaluateIntegrationReadiness({ type: 'payment', checks });
  assert.equal(result.configured, true);
  assert.equal(result.status, 'READY_FOR_AUTHORIZATION');
  assert.equal(result.operationAuthorized, false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.missing), true);
});

test('payment readiness rejects malformed check containers', () => {
  for (const checks of [null, true, false, 'ready', 1, []]) {
    assert.throws(() => evaluateIntegrationReadiness({ type: 'payment', checks }), {
      code: 'INVALID_CHECKS'
    });
  }
});
