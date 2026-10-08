
import test from "node:test";
import assert from "node:assert/strict";

import {
  FiscalService,
} from "../src/fiscal-service.mjs";

import {
  MOCK_FISCAL_OUTCOMES,
} from "../src/mock-driver.mjs";

import {
  createDefaultFiscalRegistry,
} from "../src/driver-registry.mjs";

/**
 * RC ORDERA — FISCAL SERVICE REGRESSION TESTS
 *
 * Target: FiscalService V1.2
 *
 * SIMULATION ONLY.
 *
 * No physical printer.
 * No legal fiscal issuance.
 * No database writes.
 * No network requests.
 * No timers, polling or background processes.
 *
 * Tests cover:
 * - Connection management
 * - Unsupported devices
 * - Simulation safety
 * - Idempotency
 * - Financial validation
 * - Failed connection cleanup
 * - Lost acknowledgements
 * - Concurrency
 * - Unknown-operation protection
 * - Disconnect protection
 * - Reconciliation operation identity
 * - Invalid simulator responses
 * - Reconciliation error recovery
 */

const OPERATION_ID =
  "11111111-1111-4111-8111-111111111111";

const RESTAURANT_ID =
  "22222222-2222-4222-8222-222222222222";

const ORDER_ID =
  "33333333-3333-4333-8333-333333333333";

const OTHER_OPERATION_ID =
  "99999999-9999-4999-8999-999999999999";

const receipt = () => ({
  operationId: OPERATION_ID,
  restaurantId: RESTAURANT_ID,
  orderId: ORDER_ID,
  currency: "PLN",
  totalGrosz: 6000,
  items: [
    {
      name: "Bandeja paisa",
      quantityMilli: 1000,
      grossTotalGrosz: 6000,
      taxCode: "VAT_FOOD",
    },
  ],
});

/**
 * Isolated test registry.
 *
 * Never connects to real hardware.
 * Used only to simulate malformed driver responses.
 */
function createControlledService(overrides = {}) {
  const driver = {
    async connect() {
      return {
        connected: true,
        simulated: true,
      };
    },

    async reconcile(operationId) {
      return {
        operationId,
        status: "confirmed",
        simulated: true,
        fiscal: false,
      };
    },

    async disconnect() {
      return {
        connected: false,
      };
    },

    ...overrides,
  };

  const registry = {
    create() {
      return driver;
    },
  };

  return {
    service: new FiscalService(registry),
    driver,
  };
}

// ----------------------------------------------------------
// 1. Initial state
// ----------------------------------------------------------

test("Starts disconnected", async () => {
  const service = new FiscalService();

  const status = await service.getStatus();

  assert.equal(status.connected, false);
  assert.equal(status.driverId, null);
});

// ----------------------------------------------------------
// 2. Unsupported fiscal devices
// ----------------------------------------------------------

test("Rejects unsupported fiscal device", async () => {
  const service = new FiscalService();

  await assert.rejects(
    service.connect("posnet"),
    {
      code: "UNSUPPORTED_FISCAL_DEVICE",
    }
  );

  const status = await service.getStatus();

  assert.equal(status.connected, false);
});

// ----------------------------------------------------------
// 3. Explicit simulator connection
// ----------------------------------------------------------

test("Connects simulator explicitly", async () => {
  const service = new FiscalService();

  const result = await service.connect("mock");

  assert.equal(result.connected, true);
  assert.equal(result.simulated, true);
  assert.equal(result.driverId, "mock");

  await service.disconnect();

  const status = await service.getStatus();

  assert.equal(status.connected, false);
});

// ----------------------------------------------------------
// 4. Simulation requires connection
// ----------------------------------------------------------

test("Simulation requires connection", async () => {
  const service = new FiscalService();

  await assert.rejects(
    service.simulateReceipt(receipt()),
    {
      code: "SIMULATION_NOT_AVAILABLE",
    }
  );
});

// ----------------------------------------------------------
// 5. Simulated receipt never represents legal emission
// ----------------------------------------------------------

test("Simulated receipt is never fiscal", async () => {
  const service = new FiscalService();

  await service.connect("mock");

  const result =
    await service.simulateReceipt(receipt());

  assert.equal(result.operationId, OPERATION_ID);
  assert.equal(result.status, "confirmed");
  assert.equal(result.simulated, true);
  assert.equal(result.fiscal, false);
  assert.equal(result.totalGrosz, 6000);

  await service.disconnect();
});

// ----------------------------------------------------------
// 6. Idempotency
// ----------------------------------------------------------

test("Duplicate simulated operation is idempotent", async () => {
  const service = new FiscalService();

  await service.connect("mock");

  const first =
    await service.simulateReceipt(receipt());

  const second =
    await service.simulateReceipt(receipt());

  assert.equal(first.status, "confirmed");
  assert.equal(second.status, "confirmed");

  assert.equal(
    first.mockReceiptNumber,
    second.mockReceiptNumber
  );

  assert.equal(second.alreadyProcessed, true);

  const status = await service.getStatus();

  assert.equal(status.issuedCount, 1);

  await service.disconnect();
});

// ----------------------------------------------------------
// 7. Financial validation
// ----------------------------------------------------------

test("Invalid totals are rejected", async () => {
  const service = new FiscalService();

  await service.connect("mock");

  const invalid = receipt();

  invalid.totalGrosz = 7000;

  await assert.rejects(
    service.simulateReceipt(invalid),
    {
      code: "TOTAL_MISMATCH",
    }
  );

  const status = await service.getStatus();

  assert.equal(status.issuedCount, 0);

  await service.disconnect();
});

// ----------------------------------------------------------
// 8. Cleanup after partial connection failure
// ----------------------------------------------------------

test("Failed connection releases partial resources", async () => {
  let disconnectCalls = 0;

  const partialDriver = {
    async connect() {
      throw new Error("SIMULATED_CONNECT_FAILURE");
    },

    async disconnect() {
      disconnectCalls++;

      return {
        connected: false,
      };
    },
  };

  const registry = {
    create() {
      return partialDriver;
    },
  };

  const service = new FiscalService(registry);

  await assert.rejects(
    service.connect("test_device"),
    /SIMULATED_CONNECT_FAILURE/
  );

  assert.equal(disconnectCalls, 1);

  const status = await service.getStatus();

  assert.equal(status.connected, false);
});

// ----------------------------------------------------------
// 9. Lost fiscal acknowledgement
// ----------------------------------------------------------

test("Lost fiscal ACK reconciles without duplicate", async () => {
  let mockDriver;

  const registry = createDefaultFiscalRegistry();

  const controlledRegistry = {
    create(id, options) {
      mockDriver = registry.create(id, options);
      return mockDriver;
    },
  };

  const service = new FiscalService(
    controlledRegistry
  );

  await service.connect("mock");

  mockDriver.setNextOutcome(
    MOCK_FISCAL_OUTCOMES.UNKNOWN_AFTER
  );

  const first =
    await service.simulateReceipt(receipt());

  assert.equal(first.status, "unknown");
  assert.equal(first.simulated, true);
  assert.equal(first.fiscal, false);

  assert.equal(
    mockDriver.getDiagnostics().issuedCount,
    1
  );

  const reconciled =
    await service.reconcileSimulation(
      OPERATION_ID
    );

  assert.equal(reconciled.operationId, OPERATION_ID);
  assert.equal(reconciled.status, "confirmed");
  assert.equal(reconciled.simulated, true);
  assert.equal(reconciled.fiscal, false);

  assert.equal(
    mockDriver.getDiagnostics().issuedCount,
    1
  );

  await service.disconnect();
});

// ----------------------------------------------------------
// 10. Concurrent fiscal requests
// ----------------------------------------------------------

test("Concurrent fiscal requests cannot run together", async () => {
  const service = new FiscalService();

  await service.connect("mock");

  const results = await Promise.allSettled([
    service.simulateReceipt(receipt()),
    service.simulateReceipt(receipt()),
  ]);

  const successful = results.filter(
    result => result.status === "fulfilled"
  );

  const rejected = results.filter(
    result => result.status === "rejected"
  );

  assert.equal(successful.length, 1);
  assert.equal(rejected.length, 1);

  assert.equal(
    rejected[0].reason.code,
    "SIMULATION_NOT_AVAILABLE"
  );

  assert.equal(
    successful[0].value.simulated,
    true
  );

  assert.equal(
    successful[0].value.fiscal,
    false
  );

  const status = await service.getStatus();

  assert.equal(status.issuedCount, 1);

  await service.disconnect();
});

// ----------------------------------------------------------
// 11. Unknown operation cannot be resent
// ----------------------------------------------------------

test("Unknown operation blocks automatic retry", async () => {
  let mockDriver;

  const registry = createDefaultFiscalRegistry();

  const controlledRegistry = {
    create(id, options) {
      mockDriver = registry.create(id, options);
      return mockDriver;
    },
  };

  const service = new FiscalService(
    controlledRegistry
  );

  await service.connect("mock");

  mockDriver.setNextOutcome(
    MOCK_FISCAL_OUTCOMES.UNKNOWN_BEFORE
  );

  const first =
    await service.simulateReceipt(receipt());

  assert.equal(first.status, "unknown");

  await assert.rejects(
    service.simulateReceipt(receipt()),
    {
      code: "OPERATION_REQUIRES_RECONCILIATION",
    }
  );

  const status = await service.getStatus();

  assert.equal(status.issuedCount, 0);

  const reconciliation =
    await service.reconcileSimulation(
      OPERATION_ID
    );

  assert.equal(reconciliation.status, "unknown");
  assert.equal(reconciliation.fiscal, false);

  await service.disconnect();
});

// ----------------------------------------------------------
// 12. Disconnect protection
// ----------------------------------------------------------

test("Cannot disconnect during a pending operation", async () => {
  const service = new FiscalService();

  await service.connect("mock");

  const operation =
    service.simulateReceipt(receipt());

  await assert.rejects(
    service.disconnect(),
    {
      code: "SERVICE_BUSY",
    }
  );

  const result = await operation;

  assert.equal(result.status, "confirmed");
  assert.equal(result.fiscal, false);

  await service.disconnect();

  const status = await service.getStatus();

  assert.equal(status.connected, false);
});

// ----------------------------------------------------------
// 13. Reconciliation identity protection
// ----------------------------------------------------------

test("Rejects reconciliation with mismatched operation ID", async () => {
  const { service } = createControlledService({
    async reconcile() {
      return {
        operationId: OTHER_OPERATION_ID,
        status: "confirmed",
        simulated: true,
        fiscal: false,
      };
    },
  });

  await service.connect("mock");

  await assert.rejects(
    service.reconcileSimulation(OPERATION_ID),
    {
      code: "INVALID_RECONCILIATION_RESULT",
    }
  );

  await service.disconnect();
});

// ----------------------------------------------------------
// 14. Reject real fiscal confirmations from simulator
// ----------------------------------------------------------

test("Rejects fiscal=true during simulation reconciliation", async () => {
  const { service } = createControlledService({
    async reconcile(operationId) {
      return {
        operationId,
        status: "confirmed",
        simulated: true,
        fiscal: true,
      };
    },
  });

  await service.connect("mock");

  await assert.rejects(
    service.reconcileSimulation(OPERATION_ID),
    {
      code: "INVALID_RECONCILIATION_RESULT",
    }
  );

  await service.disconnect();
});

// ----------------------------------------------------------
// 15. Reject invalid reconciliation status
// ----------------------------------------------------------

test("Rejects invalid reconciliation status", async () => {
  const { service } = createControlledService({
    async reconcile(operationId) {
      return {
        operationId,
        status: "printed_without_confirmation",
        simulated: true,
        fiscal: false,
      };
    },
  });

  await service.connect("mock");

  await assert.rejects(
    service.reconcileSimulation(OPERATION_ID),
    {
      code: "INVALID_RECONCILIATION_RESULT",
    }
  );

  await service.disconnect();
});

// ----------------------------------------------------------
// 16. Reject missing operation identity
// ----------------------------------------------------------

test("Rejects reconciliation without operation ID", async () => {
  const { service } = createControlledService({
    async reconcile() {
      return {
        status: "confirmed",
        simulated: true,
        fiscal: false,
      };
    },
  });

  await service.connect("mock");

  await assert.rejects(
    service.reconcileSimulation(OPERATION_ID),
    {
      code: "INVALID_RECONCILIATION_RESULT",
    }
  );

  await service.disconnect();
});

// ----------------------------------------------------------
// 17. Recover after reconciliation throws an error
// ----------------------------------------------------------

test("Reconciliation error does not permanently lock service", async () => {
  let shouldFail = true;

  const { service } = createControlledService({
    async reconcile(operationId) {
      if (shouldFail) {
        shouldFail = false;

        throw new Error(
          "SIMULATED_RECONCILIATION_FAILURE"
        );
      }

      return {
        operationId,
        status: "unknown",
        simulated: true,
        fiscal: false,
      };
    },
  });

  await service.connect("mock");

  await assert.rejects(
    service.reconcileSimulation(OPERATION_ID),
    /SIMULATED_RECONCILIATION_FAILURE/
  );

  const result =
    await service.reconcileSimulation(
      OPERATION_ID
    );

  assert.equal(result.operationId, OPERATION_ID);
  assert.equal(result.status, "unknown");
  assert.equal(result.fiscal, false);

  await service.disconnect();
});

// ----------------------------------------------------------
// 18. Reject malformed reconciliation response
// ----------------------------------------------------------

test("Rejects null reconciliation response", async () => {
  const { service } = createControlledService({
    async reconcile() {
      return null;
    },
  });

  await service.connect("mock");

  await assert.rejects(
    service.reconcileSimulation(OPERATION_ID),
    {
      code: "INVALID_RECONCILIATION_RESULT",
    }
  );

  await service.disconnect();
});
