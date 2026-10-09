
import {
  validateFiscalReceipt,
  assertFiscalTransition,
  requireUuid,
} from "../../fiscal-bridge/src/fiscal-contract.mjs";

/**
 * RC ORDERA — INTEGRATION GUARDS V1.0
 *
 * Compatible with the current fiscal contract
 * and external order validation schema.
 *
 * SECURITY:
 * - Strict tenant scope checks
 * - Explicit provider identity
 * - Exact monetary arithmetic in groszy
 * - Product and quantity validation
 * - Duplicate product protection
 * - Fiscal contract reuse
 * - Fail-closed authorization defaults
 *
 * PERFORMANCE:
 * - Bounded item processing
 * - No database connections
 * - No network calls
 * - No polling
 * - No timers
 * - No background workers
 *
 * IMPORTANT:
 * This module is PURE VALIDATION.
 *
 * It does not authenticate webhooks.
 * It does not authorize order import.
 * It does not issue fiscal receipts.
 * It does not communicate with hardware.
 */

export const INTEGRATION_GUARDS_VERSION = "1.0.0";

export const INTEGRATION_LIMITS = Object.freeze({
  MAX_ITEMS: 60,
  MAX_QUANTITY: 100,
  MAX_EXTERNAL_ID_LENGTH: 160,
  MAX_PRODUCT_ID_LENGTH: 200,
  MAX_UNIT_PRICE_GROSZ: 9999999999,
  MAX_LINE_TOTAL_GROSZ: 999999999999,
  MAX_FEE_GROSZ: 99999999999,
});

const PROVIDER_PATTERN =
  /^[a-z][a-z0-9_]{1,39}$/;

const REVIEWABLE_STATES = new Set([
  "received",
  "needs_review",
]);

export class IntegrationGuardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IntegrationGuardError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new IntegrationGuardError(code, message);
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function requireRecord(value, field) {
  if (!isRecord(value)) {
    fail(
      "INVALID_RECORD",
      `Invalid ${field}`
    );
  }

  return value;
}

function requireIdentifier(
  value,
  field,
  maxLength
) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maxLength ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(
      "INVALID_IDENTIFIER",
      `Invalid ${field}`
    );
  }

  return value;
}

function requireAmount(
  value,
  field,
  maximum = Number.MAX_SAFE_INTEGER
) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maximum
  ) {
    fail(
      "INVALID_AMOUNT",
      `Invalid ${field}`
    );
  }

  return value;
}

function addMoney(a, b) {
  const result = a + b;

  if (!Number.isSafeInteger(result)) {
    fail(
      "MONEY_OVERFLOW",
      "Monetary amount exceeds safe integer range"
    );
  }

  return result;
}

/**
 * Validate a provider identifier.
 *
 * This does not authenticate the provider.
 */
export function validateProviderId(providerId) {
  if (
    typeof providerId !== "string" ||
    !PROVIDER_PATTERN.test(providerId)
  ) {
    fail(
      "INVALID_PROVIDER",
      "Invalid provider identifier"
    );
  }

  return providerId;
}

/**
 * Validate a normalized external order item.
 *
 * Expected format:
 *
 * {
 *   productId: "external-product",
 *   quantity: 2,
 *   unitPriceGrosz: 1200,
 *   lineTotalGrosz: 2400
 * }
 */
export function validateExternalItem(item) {
  requireRecord(item, "item");

  const productId = requireIdentifier(
    item.productId,
    "productId",
    INTEGRATION_LIMITS.MAX_PRODUCT_ID_LENGTH
  );

  const quantity = requireAmount(
    item.quantity,
    "quantity",
    INTEGRATION_LIMITS.MAX_QUANTITY
  );

  if (quantity === 0) {
    fail(
      "INVALID_QUANTITY",
      "Item quantity must be positive"
    );
  }

  const unitPriceGrosz = requireAmount(
    item.unitPriceGrosz,
    "unitPriceGrosz",
    INTEGRATION_LIMITS.MAX_UNIT_PRICE_GROSZ
  );

  const lineTotalGrosz = requireAmount(
    item.lineTotalGrosz,
    "lineTotalGrosz",
    INTEGRATION_LIMITS.MAX_LINE_TOTAL_GROSZ
  );

  const expected = quantity * unitPriceGrosz;

  if (
    !Number.isSafeInteger(expected) ||
    expected !== lineTotalGrosz
  ) {
    fail(
      "LINE_TOTAL_MISMATCH",
      "Item amount does not match quantity and price"
    );
  }

  return Object.freeze({
    productId,
    quantity,
    unitPriceGrosz,
    lineTotalGrosz,
  });
}

/**
 * Validate the financial snapshot of an
 * already normalized external order.
 *
 * All monetary values must be integer groszy.
 */
export function validateExternalMoney({
  items,
  deliveryFeeGrosz,
  serviceFeeGrosz,
  discountGrosz,
  totalGrosz,
} = {}) {
  if (
    !Array.isArray(items) ||
    items.length < 1 ||
    items.length > INTEGRATION_LIMITS.MAX_ITEMS
  ) {
    fail(
      "INVALID_ITEMS",
      "Invalid external order item count"
    );
  }

  const validatedItems = [];
  const productIds = new Set();

  let itemsTotalGrosz = 0;

  for (const item of items) {
    const validated = validateExternalItem(item);

    if (productIds.has(validated.productId)) {
      fail(
        "DUPLICATE_PRODUCT_ID",
        "Duplicate external product identifier"
      );
    }

    productIds.add(validated.productId);
    validatedItems.push(validated);

    itemsTotalGrosz = addMoney(
      itemsTotalGrosz,
      validated.lineTotalGrosz
    );
  }

  const delivery = requireAmount(
    deliveryFeeGrosz,
    "deliveryFeeGrosz",
    INTEGRATION_LIMITS.MAX_FEE_GROSZ
  );

  const service = requireAmount(
    serviceFeeGrosz,
    "serviceFeeGrosz",
    INTEGRATION_LIMITS.MAX_FEE_GROSZ
  );

  const discount = requireAmount(
    discountGrosz,
    "discountGrosz",
    INTEGRATION_LIMITS.MAX_FEE_GROSZ
  );

  const declared = requireAmount(
    totalGrosz,
    "totalGrosz"
  );

  const beforeDiscount = addMoney(
    addMoney(itemsTotalGrosz, delivery),
    service
  );

  if (discount > beforeDiscount) {
    fail(
      "INVALID_DISCOUNT",
      "Discount exceeds the order amount"
    );
  }

  const calculatedTotalGrosz =
    beforeDiscount - discount;

  if (calculatedTotalGrosz !== declared) {
    fail(
      "ORDER_TOTAL_MISMATCH",
      "Declared total does not match calculated total"
    );
  }

  return Object.freeze({
    items: Object.freeze(validatedItems),
    itemsTotalGrosz,
    deliveryFeeGrosz: delivery,
    serviceFeeGrosz: service,
    discountGrosz: discount,
    calculatedTotalGrosz,
    totalGrosz: declared,
    arithmeticValid: true,
  });
}

/**
 * Inspect an external order already persisted
 * in rc_external_delivery_inbox.
 *
 * trustedRestaurantId and trustedProviderId
 * MUST originate from authenticated backend
 * configuration, never from webhook payloads.
 *
 * This function does not authorize imports.
 */
export function inspectExternalOrder({
  trustedRestaurantId,
  trustedProviderId,
  record,
} = {}) {
  const expectedRestaurantId = requireUuid(
    trustedRestaurantId,
    "trustedRestaurantId"
  );

  const expectedProviderId =
    validateProviderId(trustedProviderId);

  requireRecord(record, "record");

  const actualRestaurantId = requireUuid(
    record.restaurant_user_id,
    "restaurant_user_id"
  );

  if (
    actualRestaurantId !== expectedRestaurantId
  ) {
    fail(
      "TENANT_SCOPE_MISMATCH",
      "External order belongs to another restaurant"
    );
  }

  const actualProviderId =
    validateProviderId(record.platform);

  if (
    actualProviderId !== expectedProviderId
  ) {
    fail(
      "PROVIDER_SCOPE_MISMATCH",
      "External order belongs to another provider"
    );
  }

  const externalOrderId = requireIdentifier(
    record.external_order_id,
    "external_order_id",
    INTEGRATION_LIMITS.MAX_EXTERNAL_ID_LENGTH
  );

  if (
    !REVIEWABLE_STATES.has(
      record.processing_status
    )
  ) {
    fail(
      "ORDER_NOT_REVIEWABLE",
      "Order is not in a reviewable state"
    );
  }

  if (record.internal_order_id !== null) {
    fail(
      "ORDER_ALREADY_LINKED",
      "External order already has an internal order"
    );
  }

  if (record.currency !== "PLN") {
    fail(
      "UNSUPPORTED_CURRENCY",
      "Only PLN is supported by this contract"
    );
  }

  const payload = requireRecord(
    record.payload,
    "payload"
  );

  const money = validateExternalMoney({
    items: payload.items,
    deliveryFeeGrosz:
      payload.deliveryFeeGrosz,
    serviceFeeGrosz:
      payload.serviceFeeGrosz,
    discountGrosz:
      payload.discountGrosz,
    totalGrosz:
      record.total_grosz,
  });

  return Object.freeze({
    restaurantId: expectedRestaurantId,
    providerId: expectedProviderId,
    externalOrderId,
    processingStatus:
      record.processing_status,
    currency: "PLN",
    money,
    arithmeticValid: true,

    // Never grant authorization from
    // an in-memory validation.
    reviewRequired: true,
    importAllowed: false,
    fiscalPrintAllowed: false,

    verdict: "MANUAL_REVIEW_REQUIRED",
  });
}

/**
 * Validate a fiscal receipt using the
 * existing RC ORDERA fiscal contract.
 *
 * Prevents duplicate fiscal validation logic.
 *
 * This does not issue or authorize receipts.
 */
export function inspectFiscalReceipt(input) {
  const receipt = validateFiscalReceipt(input);

  return Object.freeze({
    receipt,
    operationId: receipt.operationId,
    restaurantId: receipt.restaurantId,
    orderId: receipt.orderId,
    currency: receipt.currency,
    totalGrosz: receipt.totalGrosz,

    validated: true,
    printAllowed: false,
    fiscalConfirmed: false,
    requiresDeviceAuthorization: true,
  });
}

/**
 * Validate a fiscal state transition using
 * the existing contract.
 *
 * The result does not perform or authorize
 * a database state change.
 */
export function inspectFiscalTransition(
  from,
  to
) {
  assertFiscalTransition(from, to);

  return Object.freeze({
    from,
    to,
    structurallyAllowed: true,
    persistenceAuthorized: false,
  });
}
