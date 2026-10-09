
import test from "node:test";
import assert from "node:assert/strict";

import {
  FiscalService,
} from "../src/fiscal-service.mjs";

const OPERATION_ID =
  "11111111-1111-4111-8111-111111111111";

const OTHER_OPERATION_ID =
  "22222222-2222-4222-8222-222222222222";

/**
 * RC ORDERA — Fiscal Reconciliation Regression
 *
 * Compatible with FiscalService V1.5.
 *
 * Simulation only.
 * No real fiscal device.
 * No database writes.
 * No network connections.
 * No polling or timers.
 */

function setup(overrides = {}) {
  const calls = [];

  const driver = {
    async connect() {
      return {
        connected: true,
        simulated: true,
      };
    },

    async getStatus() {
      return {
        connected: true,
        simulated: true,
      };
    },

    async printReceipt(receipt) {
      return {
        operationId: receipt.operationId,
        status: "confirmed",
        simulated: true,
        fiscal: false,
      };
    },

    async reconcile(operationId) {
      calls.push(operationId);

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

  const service = new FiscalService({
    create() {
      return driver;
    },
  });

  return {
    service,
    calls,
  };
}

test(
  "Rejects invalid operation identifiers",
  async () => {
    const { service, calls } = setup();

    await service.connect("mock");

    for (const invalid of [
      null,
      undefined,
      "",
      "not-a-uuid",
      123,
      {},
      [],
    ]) {
      await assert.rejects(
        service.reconcileSimulation(invalid),
        { code: "INVALID_UUID" }
      );
    }

    assert.equal(calls.length, 0);

    await service.disconnect();
  }
);

test(
  "Valid reconciliation preserves identity",
  async () => {
    const { service, calls } = setup();

    await service.connect("mock");

    const result =
      await service.reconcileSimulation(
        OPERATION_ID
      );

    assert.equal(
      result.operationId,
      OPERATION_ID
    );

    assert.equal(
      result.status,
      "confirmed"
    );

    assert.equal(result.simulated, true);
    assert.equal(result.fiscal, false);

    assert.deepEqual(
      calls,
      [OPERATION_ID]
    );

    await service.disconnect();
  }
);

test(
  "Rejects mismatched operation response",
  async () => {
    const { service } = setup({
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
      service.reconcileSimulation(
        OPERATION_ID
      ),
      {
        code:
          "INVALID_RECONCILIATION_RESULT",
      }
    );

    await service.disconnect();
  }
);

test(
  "Rejects false fiscal confirmation",
  async () => {
    const { service } = setup({
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
      service.reconcileSimulation(
        OPERATION_ID
      ),
      {
        code:
          "INVALID_RECONCILIATION_RESULT",
      }
    );

    await service.disconnect();
  }
);

test(
  "Invalid UUID does not lock service",
  async () => {
    const { service } = setup();

    await service.connect("mock");

    await assert.rejects(
      service.reconcileSimulation(
        "INVALID"
      ),
      { code: "INVALID_UUID" }
    );

    const status =
      await service.getStatus();

    assert.equal(
      status.connected,
      true
    );

    await service.disconnect();
  }
);

test(
  "Driver error releases operation lock",
  async () => {
    const { service } = setup({
      async reconcile() {
        throw new Error(
          "SIMULATED_DRIVER_FAILURE"
        );
      },
    });

    await service.connect("mock");

    await assert.rejects(
      service.reconcileSimulation(
        OPERATION_ID
      ),
      /SIMULATED_DRIVER_FAILURE/
    );

    const status =
      await service.getStatus();

    assert.equal(status.connected, true);

    await service.disconnect();
  }
);

test(
  "Rejects unsupported fiscal driver",
  async () => {
    const service = new FiscalService();

    await assert.rejects(
      service.connect(
        "unregistered_device"
      ),
      {
        code:
          "UNSUPPORTED_FISCAL_DEVICE",
      }
    );
  }
);
