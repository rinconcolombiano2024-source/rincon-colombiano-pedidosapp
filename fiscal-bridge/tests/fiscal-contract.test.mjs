
import test from "node:test";
import assert from "node:assert/strict";

import {
  FiscalError,
  FiscalDriver,
  FISCAL_STATES,
  validateFiscalReceipt,
  assertFiscalTransition,
} from "../src/fiscal-contract.mjs";

const validReceipt = () => ({
  operationId:
    "11111111-1111-4111-8111-111111111111",
  restaurantId:
    "22222222-2222-4222-8222-222222222222",
  orderId:
    "33333333-3333-4333-8333-333333333333",
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

test("Valid receipt is accepted", () => {
  const receipt = validateFiscalReceipt(
    validReceipt()
  );

  assert.equal(receipt.totalGrosz, 6000);
  assert.equal(receipt.currency, "PLN");
});

test("Validated data cannot be mutated", () => {
  const receipt = validateFiscalReceipt(
    validReceipt()
  );

  assert.ok(Object.isFrozen(receipt));
  assert.ok(Object.isFrozen(receipt.items));
  assert.ok(Object.isFrozen(receipt.items[0]));
});

test("Invalid total is rejected", () => {
  const receipt = validReceipt();
  receipt.totalGrosz = 7000;

  assert.throws(
    () => validateFiscalReceipt(receipt),
    FiscalError
  );
});

test("Negative amount is rejected", () => {
  const receipt = validReceipt();
  receipt.items[0].grossTotalGrosz = -100;

  assert.throws(
    () => validateFiscalReceipt(receipt),
    FiscalError
  );
});

test("Floating point money is rejected", () => {
  const receipt = validReceipt();
  receipt.totalGrosz = 60.5;

  assert.throws(
    () => validateFiscalReceipt(receipt),
    FiscalError
  );
});

test("Unknown fiscal state cannot retry", () => {
  assert.throws(
    () => assertFiscalTransition(
      FISCAL_STATES.UNKNOWN,
      FISCAL_STATES.SENDING
    ),
    FiscalError
  );
});

test("Confirmed receipt cannot be reprinted", () => {
  assert.throws(
    () => assertFiscalTransition(
      FISCAL_STATES.CONFIRMED,
      FISCAL_STATES.SENDING
    ),
    FiscalError
  );
});

test("Pending operation can be claimed", () => {
  assert.equal(
    assertFiscalTransition(
      FISCAL_STATES.PENDING,
      FISCAL_STATES.CLAIMED
    ),
    true
  );
});

test("Base driver cannot print", async () => {
  const driver = new FiscalDriver();

  await assert.rejects(
    driver.printReceipt(validReceipt()),
    {
      name: "FiscalError",
      code: "NOT_IMPLEMENTED",
    }
  );
});
