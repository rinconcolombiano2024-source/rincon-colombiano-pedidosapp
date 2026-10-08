
/**
 * RC ORDERA — Delivery Adapter Registry V1
 *
 * Registro de adaptadores explícitos.
 * No contiene conectores oficiales.
 * No recibe webhooks ni escribe en Supabase.
 * No importa pedidos ni envía datos fiscales.
 */

export class DeliveryAdapterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DeliveryAdapterError";
    this.code = code;
  }
}

const ID_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

const REQUIRED_METHODS = Object.freeze([
  "verify",
  "normalize",
]);

export class DeliveryAdapterRegistry {
  #factories = new Map();

  register(providerId, factory) {
    if (
      typeof providerId !== "string" ||
      !ID_PATTERN.test(providerId)
    ) {
      throw new DeliveryAdapterError(
        "INVALID_PROVIDER_ID",
        "Invalid provider identifier"
      );
    }

    if (typeof factory !== "function") {
      throw new DeliveryAdapterError(
        "INVALID_FACTORY",
        "Adapter factory must be a function"
      );
    }

    if (this.#factories.has(providerId)) {
      throw new DeliveryAdapterError(
        "DUPLICATE_PROVIDER",
        "Provider already registered"
      );
    }

    this.#factories.set(providerId, factory);
  }

  create(providerId, options = {}) {
    const factory = this.#factories.get(providerId);

    if (!factory) {
      throw new DeliveryAdapterError(
        "UNSUPPORTED_PROVIDER",
        "Provider is not configured"
      );
    }

    const adapter = factory(options);

    if (
      adapter === null ||
      typeof adapter !== "object" ||
      Array.isArray(adapter)
    ) {
      throw new DeliveryAdapterError(
        "INVALID_ADAPTER",
        "Adapter must be an object"
      );
    }

    for (const method of REQUIRED_METHODS) {
      if (typeof adapter[method] !== "function") {
        throw new DeliveryAdapterError(
          "INVALID_ADAPTER",
          `Missing adapter method: ${method}`
        );
      }
    }

    return adapter;
  }

  supportedProviders() {
    return [...this.#factories.keys()];
  }
}

export function createDefaultDeliveryRegistry() {
  // Deliberately empty.
  // Providers require reviewed implementations,
  // official credentials and security tests.
  return new DeliveryAdapterRegistry();
}
