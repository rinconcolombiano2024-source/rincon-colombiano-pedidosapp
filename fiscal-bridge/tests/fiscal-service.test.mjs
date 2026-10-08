
import test from "node:test";
import assert from "node:assert/strict";

import {
  FiscalService,
} from "../src/fiscal-service.mjs";

const receipt = () => ({
  operationId:
    "11111111-1111-4111-8111-111111111111",
  restaurantId:
    "22222222-2222-4222-8222-222222222222",
  orderId:
    "33333333-3333-4333-8333-333333333333",
  currency: "PLN",
  totalGrosz: 6000,
  items: [{
    name: "Bandeja paisa",
    quantityMilli: 1000,
    grossTotalGrosz: 6000,
    taxCode: "VAT_FOOD",
  }],
});

test("Starts disconnected", async () => {
  const service = new FiscalService();
  const status = await service.getStatus();

  assert.equal(status.connected, false);
});

test("Rejects unsupported fiscal device", async () => {
  const service = new FiscalService();

  await assert.rejects(
    service.connect("posnet"),
    { code: "UNSUPPORTED_FISCAL_DEVICE" }
  );
});

test("Connects simulator explicitly", async () => {
  const service = new FiscalService();

  const result = await service.connect("mock");

  assert.equal(result.connected, true);
  assert.equal(result.simulated, true);

  await service.disconnect();
});

test("Simulation requires connection", async () => {
  const service = new FiscalService();

  await assert.rejects(
    service.simulateReceipt(receipt()),
    { code: "SIMULATION_NOT_AVAILABLE" }
  );
});

test("Simulated receipt is never fiscal", async () => {
  const service = new FiscalService();

  await service.connect("mock");

  const result =
    await service.simulateReceipt(receipt());

  assert.equal(result.status, "confirmed");
  assert.equal(result.simulated, true);
  assert.equal(result.fiscal, false);

  await service.disconnect();
});

test("Duplicate simulated operation is idempotent", async () => {
  const service = new FiscalService();

  await service.connect("mock");

  const first =
    await service.simulateReceipt(receipt());

  const second =
    await service.simulateReceipt(receipt());

  assert.equal(
    first.mockReceiptNumber,
    second.mockReceiptNumber
  );

  assert.equal(second.alreadyProcessed, true);

  await service.disconnect();
});

test("Invalid totals are rejected", async () => {
  const service = new FiscalService();
  await service.connect("mock");

  const invalid = receipt();
  invalid.totalGrosz = 7000;

  await assert.rejects(
    service.simulateReceipt(invalid),
    { code: "TOTAL_MISMATCH" }
  );

  await service.disconnect();
});


test("Failed connection releases partial resources", async () => {
  let disconnectCalls = 0;

  const partialDriver = {
    async connect() {
      throw new Error("SIMULATED_CONNECT_FAILURE");
    },

    async disconnect() {
      disconnectCalls++;
      return { connected: false };
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
