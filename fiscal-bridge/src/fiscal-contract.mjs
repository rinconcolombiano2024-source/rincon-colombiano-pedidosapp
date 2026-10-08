
/**
 * RC ORDERA — FISCAL CONTRACT V1.1
 *
 * Contrato de dominio fiscal.
 *
 * No transmite comandos a equipos fiscales.
 * No emite comprobantes fiscales.
 * No establece las tasas VAT de POSNET.
 * No permite recuperar estados desconocidos
 * sin verificacion externa acreditada.
 *
 * Compatible con Node.js ESM.
 */

export const FISCAL_CONTRACT_VERSION = "1.1.0";

export const FISCAL_CURRENCY = "PLN";

export const FISCAL_STATES = Object.freeze({
  PENDING: "pending",
  CLAIMED: "claimed",
  SENDING: "sending",
  CONFIRMED: "confirmed",
  UNKNOWN: "unknown",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

export const FISCAL_LIMITS = Object.freeze({
  MAX_ITEMS: 200,
  MAX_NAME_LENGTH: 120,
  MAX_TAX_CODE_LENGTH: 40,
  MAX_QUANTITY_MILLI: 100000000,
  MAX_TOTAL_GROSZ: 1000000000,
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRANSITIONS = Object.freeze({
  pending: Object.freeze(["claimed", "cancelled"]),
  claimed: Object.freeze(["sending", "pending"]),
  sending: Object.freeze([
    "confirmed",
    "unknown",
    "failed",
  ]),
  unknown: Object.freeze([
    "confirmed",
    "failed",
  ]),
  confirmed: Object.freeze([]),
  failed: Object.freeze([]),
  cancelled: Object.freeze([]),
});

export class FiscalError extends Error {
  constructor(code, message) {
    super(message);

    this.name = "FiscalError";
    this.code = code;
  }
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

export function requireUuid(value, field) {
  if (
    typeof value !== "string" ||
    !UUID_PATTERN.test(value)
  ) {
    throw new FiscalError(
      "INVALID_UUID",
      `Invalid ${field}`
    );
  }

  return value.toLowerCase();
}

export function requireText(
  value,
  field,
  maximum = 200
) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length === 0 ||
    value.length > maximum ||
    /[\u0000-\u001F\u007F]/u.test(value)
  ) {
    throw new FiscalError(
      "INVALID_TEXT",
      `Invalid ${field}`
    );
  }

  return value;
}

export function requireMoney(value, field) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > FISCAL_LIMITS.MAX_TOTAL_GROSZ
  ) {
    throw new FiscalError(
      "INVALID_MONEY",
      `Invalid ${field}`
    );
  }

  return value;
}

export function validateFiscalItem(item) {
  if (!isRecord(item)) {
    throw new FiscalError(
      "INVALID_ITEM",
      "Fiscal item must be an object"
    );
  }

  const name = requireText(
    item.name,
    "item.name",
    FISCAL_LIMITS.MAX_NAME_LENGTH
  );

  const quantityMilli = item.quantityMilli;

  if (
    !Number.isSafeInteger(quantityMilli) ||
    quantityMilli <= 0 ||
    quantityMilli >
      FISCAL_LIMITS.MAX_QUANTITY_MILLI
  ) {
    throw new FiscalError(
      "INVALID_QUANTITY",
      "Invalid item quantity"
    );
  }

  const grossTotalGrosz = requireMoney(
    item.grossTotalGrosz,
    "item.grossTotalGrosz"
  );

  if (grossTotalGrosz === 0) {
    throw new FiscalError(
      "ZERO_VALUE_ITEM",
      "Zero-value items require separate handling"
    );
  }

  /**
   * taxCode es una referencia interna.
   *
   * Su correspondencia con una tasa VAT
   * y la letra fiscal del dispositivo debe
   * validarse en el servidor antes de emitir.
   */
  const taxCode = requireText(
    item.taxCode,
    "item.taxCode",
    FISCAL_LIMITS.MAX_TAX_CODE_LENGTH
  );

  return Object.freeze({
    name,
    quantityMilli,
    grossTotalGrosz,
    taxCode,
  });
}

export function validateFiscalReceipt(receipt) {
  if (!isRecord(receipt)) {
    throw new FiscalError(
      "INVALID_RECEIPT",
      "Receipt must be an object"
    );
  }

  const operationId = requireUuid(
    receipt.operationId,
    "operationId"
  );

  const restaurantId = requireUuid(
    receipt.restaurantId,
    "restaurantId"
  );

  const orderId = requireUuid(
    receipt.orderId,
    "orderId"
  );

  if (receipt.currency !== FISCAL_CURRENCY) {
    throw new FiscalError(
      "UNSUPPORTED_CURRENCY",
      "Unsupported fiscal currency"
    );
  }

  if (
    !Array.isArray(receipt.items) ||
    receipt.items.length === 0 ||
    receipt.items.length >
      FISCAL_LIMITS.MAX_ITEMS
  ) {
    throw new FiscalError(
      "INVALID_ITEMS",
      "Invalid number of fiscal items"
    );
  }

  const items = receipt.items.map(
    validateFiscalItem
  );

  let calculatedTotal = 0;

  for (const item of items) {
    calculatedTotal += item.grossTotalGrosz;

    if (
      !Number.isSafeInteger(calculatedTotal) ||
      calculatedTotal >
        FISCAL_LIMITS.MAX_TOTAL_GROSZ
    ) {
      throw new FiscalError(
        "TOTAL_OVERFLOW",
        "Fiscal total exceeds allowed limit"
      );
    }
  }

  const totalGrosz = requireMoney(
    receipt.totalGrosz,
    "receipt.totalGrosz"
  );

  if (
    totalGrosz === 0 ||
    calculatedTotal !== totalGrosz
  ) {
    throw new FiscalError(
      "TOTAL_MISMATCH",
      "Invalid fiscal receipt total"
    );
  }

  return Object.freeze({
    operationId,
    restaurantId,
    orderId,
    currency: FISCAL_CURRENCY,
    items: Object.freeze(items),
    totalGrosz,
  });
}

export function assertFiscalTransition(
  from,
  to
) {
  const allowed = TRANSITIONS[from];

  if (!allowed || !allowed.includes(to)) {
    throw new FiscalError(
      "INVALID_STATE_TRANSITION",
      `Forbidden transition: ${from} -> ${to}`
    );
  }

  return true;
}

/**
 * Reglas importantes:
 *
 * 1. La autorizacion y los bloqueos deben
 *    verificarse atomicamente en el servidor.
 *
 * 2. UNKNOWN nunca se reintenta
 *    automaticamente.
 *
 * 3. CONFIRMED solo puede establecerse
 *    despues de confirmar la emision real.
 *
 * 4. Este metodo solo valida transiciones:
 *    NO actualiza estados persistidos.
 *
 * 5. El resultado del dispositivo debe
 *    verificarse fuera de este contrato.
 */

export class FiscalDriver {
  async connect() {
    throw new FiscalError(
      "NOT_IMPLEMENTED",
      "connect() not implemented"
    );
  }

  async getStatus() {
    throw new FiscalError(
      "NOT_IMPLEMENTED",
      "getStatus() not implemented"
    );
  }

  async printReceipt(_receipt) {
    throw new FiscalError(
      "NOT_IMPLEMENTED",
      "printReceipt() not implemented"
    );
  }

  async reconcile(_operationId) {
    throw new FiscalError(
      "NOT_IMPLEMENTED",
      "reconcile() not implemented"
    );
  }

  async disconnect() {
    throw new FiscalError(
      "NOT_IMPLEMENTED",
      "disconnect() not implemented"
    );
  }
}
