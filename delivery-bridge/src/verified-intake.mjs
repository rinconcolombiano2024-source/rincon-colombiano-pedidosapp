
import {
  validateProviderId,
  validateExternalMoney,
} from "../../integrations/src/integration-guards.mjs";

import {
  createDefaultDeliveryRegistry,
} from "./adapter-registry.mjs";

/**
 * RC ORDERA — Verified Delivery Intake V1.0
 *
 * Transport-agnostic verification boundary.
 *
 * Each provider adapter MUST verify its
 * own official authentication protocol.
 *
 * No persistence, fiscal issuance, customer
 * order creation, payment capture, network
 * requests, polling or automatic retries.
 *
 * Only explicitly registered adapters run.
 *
 * Passing this stage DOES NOT authorize
 * importing an order.
 */

const MAX_BODY_BYTES = 65536;
const MAX_TOTAL_QUANTITY = 100;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DeliveryIntakeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DeliveryIntakeError";
    this.code = code;
  }
}

function reject(code, message) {
  throw new DeliveryIntakeError(code, message);
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function identifier(
  value,
  field,
  maxLength = 160
) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maxLength ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    reject(
      "INVALID_IDENTIFIER",
      `Invalid ${field}`
    );
  }

  return value;
}

function restaurantId(value) {
  if (
    typeof value !== "string" ||
    !UUID_PATTERN.test(value)
  ) {
    reject(
      "INVALID_RESTAURANT_ID",
      "Trusted restaurant ID must be a UUID"
    );
  }

  return value.toLowerCase();
}

export class VerifiedDeliveryIntake {
  #registry;

  constructor(
    registry = createDefaultDeliveryRegistry()
  ) {
    if (
      !registry ||
      typeof registry.create !== "function"
    ) {
      reject(
        "INVALID_REGISTRY",
        "Delivery adapter registry required"
      );
    }

    this.#registry = registry;
  }

  /**
   * trustedRestaurantId MUST come from
   * authenticated backend configuration.
   *
   * rawBody MUST contain the original
   * HTTP request bytes.
   *
   * Provider adapters implement:
   *
   * verify({rawBody, headers, providerId})
   * normalize({rawBody, headers, providerId})
   */
  async prepare({
    trustedRestaurantId,
    providerId,
    rawBody,
    headers = {},
  } = {}) {
    const trustedId =
      restaurantId(trustedRestaurantId);

    const provider =
      validateProviderId(providerId);

    if (
      !(rawBody instanceof Uint8Array) ||
      rawBody.byteLength < 1 ||
      rawBody.byteLength > MAX_BODY_BYTES
    ) {
      reject(
        "INVALID_BODY",
        "Invalid external message size or type"
      );
    }

    // Isolate the original request bytes.
    const originalBytes =
      new Uint8Array(rawBody);

    let originalHeaders;

    try {
      originalHeaders = new Headers(headers);
    } catch {
      reject(
        "INVALID_HEADERS",
        "Invalid request headers"
      );
    }

    // Unknown providers fail closed.
    const adapter =
      this.#registry.create(provider);

    let verified;

    try {
      verified = await adapter.verify({
        rawBody: new Uint8Array(
          originalBytes
        ),
        headers: new Headers(
          originalHeaders
        ),
        providerId: provider,
      });
    } catch {
      reject(
        "VERIFICATION_FAILED",
        "Provider verification failed"
      );
    }

    // Strict boolean authentication.
    if (verified !== true) {
      reject(
        "UNVERIFIED_MESSAGE",
        "Provider signature not verified"
      );
    }

    let normalized;

    try {
      normalized = await adapter.normalize({
        rawBody: new Uint8Array(
          originalBytes
        ),
        headers: new Headers(
          originalHeaders
        ),
        providerId: provider,
      });
    } catch {
      reject(
        "NORMALIZATION_FAILED",
        "Provider normalization failed"
      );
    }

    if (!isRecord(normalized)) {
      reject(
        "INVALID_NORMALIZED_ORDER",
        "Normalized order must be an object"
      );
    }

    // External payloads cannot override
    // authenticated restaurant identity.
    if (
      normalized.restaurantId !== undefined &&
      restaurantId(
        normalized.restaurantId
      ) !== trustedId
    ) {
      reject(
        "TENANT_SCOPE_MISMATCH",
        "Restaurant mismatch"
      );
    }

    // External payloads cannot override
    // the configured provider.
    if (
      normalized.providerId !== undefined &&
      validateProviderId(
        normalized.providerId
      ) !== provider
    ) {
      reject(
        "PROVIDER_SCOPE_MISMATCH",
        "Provider mismatch"
      );
    }

    if (normalized.currency !== "PLN") {
      reject(
        "UNSUPPORTED_CURRENCY",
        "Only PLN is supported"
      );
    }

    const externalOrderId = identifier(
      normalized.externalOrderId,
      "externalOrderId"
    );

    const externalEventId = identifier(
      normalized.externalEventId,
      "externalEventId"
    );

    const eventType = identifier(
      normalized.eventType,
      "eventType",
      80
    );

    const sourceStatus = identifier(
      normalized.sourceStatus,
      "sourceStatus",
      80
    );

    // Modifiers require separate catalog
    // validation before they can be accepted.
    if (
      Array.isArray(normalized.items) &&
      normalized.items.some(
        item =>
          isRecord(item) &&
          item.modifiers !== undefined &&
          (
            !Array.isArray(item.modifiers) ||
            item.modifiers.length !== 0
          )
      )
    ) {
      reject(
        "UNSUPPORTED_MODIFIERS",
        "Modifier review is required"
      );
    }

    const money = validateExternalMoney({
      items: normalized.items,
      deliveryFeeGrosz:
        normalized.deliveryFeeGrosz,
      serviceFeeGrosz:
        normalized.serviceFeeGrosz,
      discountGrosz:
        normalized.discountGrosz,
      totalGrosz:
        normalized.totalGrosz,
    });

    const totalQuantity = money.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    if (
      totalQuantity > MAX_TOTAL_QUANTITY
    ) {
      reject(
        "TOTAL_QUANTITY_EXCEEDED",
        "Order quantity exceeds limit"
      );
    }

    // Validated financial snapshot.
    // This is NOT authorization to create
    // an internal order or fiscal receipt.
    const payload = Object.freeze({
      items: money.items,
      deliveryFeeGrosz:
        money.deliveryFeeGrosz,
      serviceFeeGrosz:
        money.serviceFeeGrosz,
      discountGrosz:
        money.discountGrosz,
    });

    return Object.freeze({
      restaurantId: trustedId,
      providerId: provider,
      externalOrderId,
      externalEventId,
      eventType,
      sourceStatus,
      currency: "PLN",
      totalGrosz: money.totalGrosz,
      payload,

      verified: true,
      arithmeticValid: true,

      reviewRequired: true,
      importAllowed: false,
      fiscalPrintAllowed: false,

      verdict:
        "VERIFIED_MANUAL_REVIEW_REQUIRED",
    });
  }
}
