
import test from "node:test";
import assert from "node:assert/strict";

import {
  MockFiscalDriver,
  MOCK_FISCAL_OUTCOMES,
} from "../src/mock-driver.mjs";

function receipt(id) {
  return {
    operationId: id,
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
  };
}

const ID =
  "11111111-1111-4111-8111-111111111111";

test("No printing while disconnected", async () => {
  const driver = new MockFiscalDriver();

  await assert.rejects(
    driver.printReceipt(receipt(ID)),
    { code: "DEVICE_DISCONNECTED" }
  );
});

test("Successful simulated operation", async () => {
  const driver = new MockFiscalDriver();

  await driver.connect();

  const result = await driver.printReceipt(
    receipt(ID)
  );

  assert.equal(result.status, "confirmed");
  assert.equal(result.simulated, true);
  assert.equal(result.fiscal, false);
  assert.equal(result.totalGrosz, 6000);
});

test("Same operation cannot print twice", async () => {
  const driver = new MockFiscalDriver();

  await driver.connect();

  const first = await driver.printReceipt(
    receipt(ID)
  );

  const second = await driver.printReceipt(
    receipt(ID)
  );

  assert.equal(
    first.mockReceiptNumber,
    second.mockReceiptNumber
  );

  assert.equal(second.alreadyProcessed, true);
  assert.equal(
    driver.getDiagnostics().issuedCount,
    1
  );
});

test("Changed payload cannot reuse ID", async () => {
  const driver = new MockFiscalDriver();

  await driver.connect();
  await driver.printReceipt(receipt(ID));

  const modified = receipt(ID);
  modified.totalGrosz = 7000;
  modified.items[0].grossTotalGrosz = 7000;

  await assert.rejects(
    driver.printReceipt(modified),
    { code: "OPERATION_CONFLICT" }
  );
});

test("Unknown before emission blocks retry", async () => {
  const driver = new MockFiscalDriver();

  await driver.connect();

  driver.setNextOutcome(
    MOCK_FISCAL_OUTCOMES.UNKNOWN_BEFORE
  );

  const result = await driver.printReceipt(
    receipt(ID)
  );

  assert.equal(result.status, "unknown");

  await assert.rejects(
    driver.printReceipt(receipt(ID)),
    {
      code: "OPERATION_REQUIRES_RECONCILIATION",
    }
  );

  const reconciled = await driver.reconcile(ID);

  assert.equal(reconciled.status, "unknown");
  assert.equal(
    driver.getDiagnostics().issuedCount,
    0
  );
});

test("Lost acknowledgement is reconciled", async () => {
  const driver = new MockFiscalDriver();

  await driver.connect();

  driver.setNextOutcome(
    MOCK_FISCAL_OUTCOMES.UNKNOWN_AFTER
  );

  const result = await driver.printReceipt(
    receipt(ID)
  );

  assert.equal(result.status, "unknown");

  const recovered = await driver.reconcile(ID);

  assert.equal(recovered.status, "confirmed");
  assert.equal(
    driver.getDiagnostics().issuedCount,
    1
  );

  const repeated = await driver.printReceipt(
    receipt(ID)
  );

  assert.equal(repeated.alreadyProcessed, true);
  assert.equal(
    driver.getDiagnostics().issuedCount,
    1
  );
});

test("Simulated rejection is not emitted", async () => {
  const driver = new MockFiscalDriver();

  await driver.connect();

  driver.setNextOutcome(
    MOCK_FISCAL_OUTCOMES.REJECTED
  );

  const result = await driver.printReceipt(
    receipt(ID)
  );

  assert.equal(result.status, "failed");
  assert.equal(result.emitted, false);
  assert.equal(
    driver.getDiagnostics().issuedCount,
    0
  );
});

test("Invalid receipt does not create operation", async () => {
  const driver = new MockFiscalDriver();

  await driver.connect();

  const invalid = receipt(ID);
  invalid.totalGrosz = -1;

  await assert.rejects(
    driver.printReceipt(invalid)
  );

  assert.equal(
    driver.getDiagnostics().operationCount,
    0
  );
});
