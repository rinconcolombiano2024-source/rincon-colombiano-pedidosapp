
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

/**
 * RC ORDERA — INTEGRATION GUARDS REGRESSION TESTS V1
 *
 * Target:
 * integrations/src/integration-guards.mjs
 *
 * Covers:
 * - Provider validation
 * - Order item validation
 * - Exact monetary arithmetic
 * - Duplicate product protection
 * - Tenant isolation
 * - Order state restrictions
 * - Fiscal receipt validation
 * - Fiscal state transitions
 * - Deny-by-default authorization
 *
 * No database writes.
 * No external requests.
 * No physical fiscal printing.
 * No polling or background workers.
 *
 * Compatible with Node.js >=22.
 */

const guardsPromise = import(
  "../integrations/src/integration-guards.mjs"
);

const RESTAURANT_ID =
  "22222222-2222-4222-8222-222222222222";

const OTHER_RESTAURANT_ID =
  "99999999-9999-4999-8999-999999999999";

const ORDER_ID =
  "33333333-3333-4333-8333-333333333333";

const OPERATION_ID =
  "11111111-1111-4111-8111-111111111111";

/**
 * Register an isolated synchronous assertion
 * against the ES module.
 */
function check(name, callback) {
  test(name, async () => {
    const guards = await guardsPromise;
    callback(guards);
  });
}

function validItem(overrides = {}) {
  return {
    productId: "bandeja",
    quantity: 2,
    unitPriceGrosz: 1200,
    lineTotalGrosz: 2400,
    ...overrides,
  };
}

function validMoney(overrides = {}) {
  return {
    items: [
      validItem(),
      {
        productId: "jugo",
        quantity: 1,
        unitPriceGrosz: 1000,
        lineTotalGrosz: 1000,
      },
    ],
    deliveryFeeGrosz: 400,
    serviceFeeGrosz: 100,
    discountGrosz: 500,
    totalGrosz: 3400,
    ...overrides,
  };
}

function validRecord(overrides = {}) {
  return {
    restaurant_user_id: RESTAURANT_ID,
    platform: "rc_test",
    external_order_id: "external-order-001",
    processing_status: "received",
    internal_order_id: null,
    currency: "PLN",
    total_grosz: 3400,
    payload: validMoney(),
    ...overrides,
  };
}

function externalRequest(record = validRecord()) {
  return {
    trustedRestaurantId: RESTAURANT_ID,
    trustedProviderId: "rc_test",
    record,
  };
}

function validFiscalReceipt(overrides = {}) {
  return {
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
    ...overrides,
  };
}

// ==========================================================
// 1. MODULE CONTRACT
// ==========================================================

check("Exports integration guard version", ({
  INTEGRATION_GUARDS_VERSION,
  INTEGRATION_LIMITS,
}) => {
  assert.equal(
    INTEGRATION_GUARDS_VERSION,
    "1.0.0"
  );

  assert.equal(
    INTEGRATION_LIMITS.MAX_ITEMS,
    60
  );
});

// ==========================================================
// 2. PROVIDER VALIDATION
// ==========================================================

check("Accepts valid provider identifiers", ({
  validateProviderId,
}) => {
  for (const provider of [
    "rc_test",
    "wolt",
    "glovo",
    "uber_eats",
    "bolt_food",
  ]) {
    assert.equal(
      validateProviderId(provider),
      provider
    );
  }
});

check("Rejects invalid provider identifiers", ({
  validateProviderId,
}) => {
  for (const provider of [
    "",
    "../wolt",
    "WOLT",
    " wolt",
    "wolt ",
    "uber.eats",
    null,
    undefined,
    123,
  ]) {
    assert.throws(
      () => validateProviderId(provider),
      {
        code: "INVALID_PROVIDER",
      }
    );
  }
});

// ==========================================================
// 3. PRODUCT VALIDATION
// ==========================================================

check("Accepts exact item arithmetic", ({
  validateExternalItem,
}) => {
  const result = validateExternalItem(
    validItem()
  );

  assert.equal(result.quantity, 2);
  assert.equal(
    result.unitPriceGrosz,
    1200
  );
  assert.equal(
    result.lineTotalGrosz,
    2400
  );

  assert.equal(
    Object.isFrozen(result),
    true
  );
});

check("Rejects invalid item structures", ({
  validateExternalItem,
}) => {
  for (const item of [
    null,
    undefined,
    [],
    "item",
    10,
  ]) {
    assert.throws(
      () => validateExternalItem(item),
      {
        code: "INVALID_RECORD",
      }
    );
  }
});

check("Rejects invalid product identifiers", ({
  validateExternalItem,
}) => {
  for (const productId of [
    "",
    " invalid",
    "invalid ",
    "bad\nid",
    "x".repeat(201),
  ]) {
    assert.throws(
      () => validateExternalItem(
        validItem({ productId })
      ),
      {
        code: "INVALID_IDENTIFIER",
      }
    );
  }
});

check("Rejects zero item quantity", ({
  validateExternalItem,
}) => {
  assert.throws(
    () => validateExternalItem(
      validItem({
        quantity: 0,
        lineTotalGrosz: 0,
      })
    ),
    {
      code: "INVALID_QUANTITY",
    }
  );
});

check("Rejects invalid item quantities", ({
  validateExternalItem,
}) => {
  for (const quantity of [
    -1,
    101,
    1.5,
    "2",
    null,
    undefined,
  ]) {
    assert.throws(
      () => validateExternalItem(
        validItem({ quantity })
      ),
      {
        code: "INVALID_AMOUNT",
      }
    );
  }
});

check("Rejects inconsistent line totals", ({
  validateExternalItem,
}) => {
  assert.throws(
    () => validateExternalItem(
      validItem({
        lineTotalGrosz: 2500,
      })
    ),
    {
      code: "LINE_TOTAL_MISMATCH",
    }
  );
});

check("Rejects invalid monetary item values", ({
  validateExternalItem,
}) => {
  for (const unitPriceGrosz of [
    -1,
    1.5,
    "1200",
    Infinity,
    NaN,
  ]) {
    assert.throws(
      () => validateExternalItem(
        validItem({ unitPriceGrosz })
      ),
      {
        code: "INVALID_AMOUNT",
      }
    );
  }
});

// ==========================================================
// 4. ORDER MONETARY VALIDATION
// ==========================================================

check("Calculates exact order total in groszy", ({
  validateExternalMoney,
}) => {
  const result = validateExternalMoney(
    validMoney()
  );

  assert.equal(
    result.itemsTotalGrosz,
    3400
  );

  assert.equal(
    result.deliveryFeeGrosz,
    400
  );

  assert.equal(
    result.serviceFeeGrosz,
    100
  );

  assert.equal(
    result.discountGrosz,
    500
  );

  assert.equal(
    result.calculatedTotalGrosz,
    3400
  );

  assert.equal(
    result.arithmeticValid,
    true
  );
});

check("Rejects empty external orders", ({
  validateExternalMoney,
}) => {
  assert.throws(
    () => validateExternalMoney(
      validMoney({ items: [] })
    ),
    {
      code: "INVALID_ITEMS",
    }
  );
});

check("Rejects external orders over item limit", ({
  validateExternalMoney,
}) => {
  const items = Array.from(
    { length: 61 },
    (_, index) => validItem({
      productId: `product-${index}`,
    })
  );

  assert.throws(
    () => validateExternalMoney(
      validMoney({ items })
    ),
    {
      code: "INVALID_ITEMS",
    }
  );
});

check("Rejects duplicate external products", ({
  validateExternalMoney,
}) => {
  assert.throws(
    () => validateExternalMoney(
      validMoney({
        items: [
          validItem(),
          validItem(),
        ],
      })
    ),
    {
      code: "DUPLICATE_PRODUCT_ID",
    }
  );
});

check("Rejects excessive discounts", ({
  validateExternalMoney,
}) => {
  assert.throws(
    () => validateExternalMoney(
      validMoney({
        discountGrosz: 5000,
      })
    ),
    {
      code: "INVALID_DISCOUNT",
    }
  );
});

check("Rejects incorrect declared order total", ({
  validateExternalMoney,
}) => {
  assert.throws(
    () => validateExternalMoney(
      validMoney({
        totalGrosz: 3401,
      })
    ),
    {
      code: "ORDER_TOTAL_MISMATCH",
    }
  );
});

check("Rejects floating-point order totals", ({
  validateExternalMoney,
}) => {
  assert.throws(
    () => validateExternalMoney(
      validMoney({
        totalGrosz: 3400.5,
      })
    ),
    {
      code: "INVALID_AMOUNT",
    }
  );
});

check("Rejects negative fees", ({
  validateExternalMoney,
}) => {
  assert.throws(
    () => validateExternalMoney(
      validMoney({
        deliveryFeeGrosz: -1,
      })
    ),
    {
      code: "INVALID_AMOUNT",
    }
  );
});

// ==========================================================
// 5. MULTITENANT AND EXTERNAL ORDER SAFETY
// ==========================================================

check("Valid order remains unauthorized", ({
  inspectExternalOrder,
}) => {
  const result = inspectExternalOrder(
    externalRequest()
  );

  assert.equal(
    result.restaurantId,
    RESTAURANT_ID
  );

  assert.equal(
    result.providerId,
    "rc_test"
  );

  assert.equal(
    result.arithmeticValid,
    true
  );

  assert.equal(
    result.reviewRequired,
    true
  );

  assert.equal(
    result.importAllowed,
    false
  );

  assert.equal(
    result.fiscalPrintAllowed,
    false
  );

  assert.equal(
    result.verdict,
    "MANUAL_REVIEW_REQUIRED"
  );
});

check("Rejects cross-restaurant orders", ({
  inspectExternalOrder,
}) => {
  assert.throws(
    () => inspectExternalOrder(
      externalRequest(
        validRecord({
          restaurant_user_id:
            OTHER_RESTAURANT_ID,
        })
      )
    ),
    {
      code: "TENANT_SCOPE_MISMATCH",
    }
  );
});

check("Rejects mismatched providers", ({
  inspectExternalOrder,
}) => {
  assert.throws(
    () => inspectExternalOrder(
      externalRequest(
        validRecord({
          platform: "wolt",
        })
      )
    ),
    {
      code: "PROVIDER_SCOPE_MISMATCH",
    }
  );
});

check("Rejects already imported orders", ({
  inspectExternalOrder,
}) => {
  assert.throws(
    () => inspectExternalOrder(
      externalRequest(
        validRecord({
          processing_status: "imported",
        })
      )
    ),
    {
      code: "ORDER_NOT_REVIEWABLE",
    }
  );
});

check("Rejects cancelled orders", ({
  inspectExternalOrder,
}) => {
  assert.throws(
    () => inspectExternalOrder(
      externalRequest(
        validRecord({
          processing_status: "cancelled",
        })
      )
    ),
    {
      code: "ORDER_NOT_REVIEWABLE",
    }
  );
});

check("Rejects already linked internal orders", ({
  inspectExternalOrder,
}) => {
  assert.throws(
    () => inspectExternalOrder(
      externalRequest(
        validRecord({
          internal_order_id: ORDER_ID,
        })
      )
    ),
    {
      code: "ORDER_ALREADY_LINKED",
    }
  );
});

check("Rejects missing internal link state", ({
  inspectExternalOrder,
}) => {
  const record = validRecord();

  delete record.internal_order_id;

  assert.throws(
    () => inspectExternalOrder(
      externalRequest(record)
    ),
    {
      code: "ORDER_ALREADY_LINKED",
    }
  );
});

check("Rejects unsupported currencies", ({
  inspectExternalOrder,
}) => {
  assert.throws(
    () => inspectExternalOrder(
      externalRequest(
        validRecord({
          currency: "EUR",
        })
      )
    ),
    {
      code: "UNSUPPORTED_CURRENCY",
    }
  );
});

check("Rejects mismatched persisted totals", ({
  inspectExternalOrder,
}) => {
  assert.throws(
    () => inspectExternalOrder(
      externalRequest(
        validRecord({
          total_grosz: 3500,
        })
      )
    ),
    {
      code: "ORDER_TOTAL_MISMATCH",
    }
  );
});

// ==========================================================
// 6. FISCAL RECEIPT VALIDATION
// ==========================================================

check("Valid fiscal receipt cannot authorize printing", ({
  inspectFiscalReceipt,
}) => {
  const result = inspectFiscalReceipt(
    validFiscalReceipt()
  );

  assert.equal(
    result.validated,
    true
  );

  assert.equal(
    result.totalGrosz,
    6000
  );

  assert.equal(
    result.printAllowed,
    false
  );

  assert.equal(
    result.fiscalConfirmed,
    false
  );

  assert.equal(
    result.requiresDeviceAuthorization,
    true
  );
});

check("Rejects incorrect fiscal totals", ({
  inspectFiscalReceipt,
}) => {
  assert.throws(
    () => inspectFiscalReceipt(
      validFiscalReceipt({
        totalGrosz: 7000,
      })
    ),
    {
      code: "TOTAL_MISMATCH",
    }
  );
});

check("Rejects invalid fiscal UUID", ({
  inspectFiscalReceipt,
}) => {
  assert.throws(
    () => inspectFiscalReceipt(
      validFiscalReceipt({
        restaurantId: "invalid",
      })
    ),
    {
      code: "INVALID_UUID",
    }
  );
});

// ==========================================================
// 7. FISCAL STATE MACHINE
// ==========================================================

check("Allows structurally valid fiscal transitions", ({
  inspectFiscalTransition,
}) => {
  for (const [from, to] of [
    ["pending", "claimed"],
    ["pending", "cancelled"],
    ["claimed", "sending"],
    ["sending", "confirmed"],
    ["sending", "unknown"],
    ["unknown", "confirmed"],
  ]) {
    const result =
      inspectFiscalTransition(from, to);

    assert.equal(
      result.structurallyAllowed,
      true
    );

    assert.equal(
      result.persistenceAuthorized,
      false
    );
  }
});

check("Blocks unsafe fiscal transitions", ({
  inspectFiscalTransition,
}) => {
  for (const [from, to] of [
    ["unknown", "pending"],
    ["unknown", "sending"],
    ["confirmed", "sending"],
    ["confirmed", "pending"],
    ["cancelled", "claimed"],
    ["failed", "confirmed"],
  ]) {
    assert.throws(
      () => inspectFiscalTransition(
        from,
        to
      ),
      {
        code: "INVALID_STATE_TRANSITION",
      }
    );
  }
});

// ==========================================================
// END OF TEST FILE
// ==========================================================
