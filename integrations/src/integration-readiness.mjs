
/**
 * RC ORDERA — Integration Readiness V1
 *
 * Evaluación pura del estado de integraciones.
 *
 * No conecta hardware.
 * No autoriza operaciones.
 * No consulta bases de datos.
 * No inicia pagos.
 * No realiza polling.
 *
 * IMPORTANTE:
 * Los estados deben proceder de servicios
 * autenticados del backend, nunca de valores
 * controlados por el navegador.
 */

export const PROVIDERS = Object.freeze([
  "uber_eats",
  "wolt",
  "glovo",
  "bolt_food",
  "pyszne",
]);

export const INTEGRATION_TYPES = Object.freeze([
  "fiscal",
  "delivery",
  "payment",
]);

export class IntegrationReadinessError
  extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IntegrationReadinessError";
    this.code = code;
  }
}

const REQUIRED = Object.freeze({
  fiscal: Object.freeze([
    "deviceRegistered",
    "agentAuthenticated",
    "driverVerified",
    "vatConfigured",
    "operationServiceReady",
    "reconciliationReady",
  ]),

  delivery: Object.freeze([
    "providerAuthorized",
    "credentialsVerified",
    "storeMapped",
    "webhookVerified",
    "catalogMapped",
    "idempotencyReady",
    "statusSyncReady",
  ]),

  payment: Object.freeze([
    "providerConfigured",
    "webhookVerified",
    "checkoutVerified",
    "idempotencyReady",
    "reconciliationReady",
    "refundsVerified",
  ]),
});

export function evaluateIntegrationReadiness({
  type,
  provider = null,
  checks = {},
} = {}) {
  if (!INTEGRATION_TYPES.includes(type)) {
    throw new IntegrationReadinessError(
      "INVALID_TYPE",
      "Unsupported integration type"
    );
  }

  if (
    type === "delivery" &&
    !PROVIDERS.includes(provider)
  ) {
    throw new IntegrationReadinessError(
      "INVALID_PROVIDER",
      "Unsupported delivery provider"
    );
  }

  if (
    checks === null ||
    typeof checks !== "object" ||
    Array.isArray(checks)
  ) {
    throw new IntegrationReadinessError(
      "INVALID_CHECKS",
      "Invalid readiness checks"
    );
  }

  const missing = [];

  for (const field of REQUIRED[type]) {
    if (checks[field] !== true) {
      missing.push(field);
    }
  }

  const ready = missing.length === 0;

  return Object.freeze({
    type,
    provider:
      type === "delivery" ? provider : null,

    configured: ready,

    missing: Object.freeze(missing),

    // Readiness is not permission.
    operationAuthorized: false,

    // Production operations require
    // separate authenticated server checks.
    status: ready
      ? "READY_FOR_AUTHORIZATION"
      : "CONFIGURATION_INCOMPLETE",
  });
}
