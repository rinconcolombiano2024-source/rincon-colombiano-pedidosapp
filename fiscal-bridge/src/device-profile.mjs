
/**
 * RC ORDERA — Fiscal Device Profile V1.0
 *
 * Validación de perfiles de hardware fiscal.
 *
 * No conecta dispositivos.
 * No transmite comandos.
 * No imprime recibos.
 * No autoriza operaciones fiscales.
 * No utiliza polling, timers ni red.
 */

const ID_PATTERN =
  /^[a-z][a-z0-9_-]{1,63}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_TEXT_LENGTH = 120;

export class DeviceProfileError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DeviceProfileError";
    this.code = code;
  }
}

function requireId(value, field) {
  if (
    typeof value !== "string" ||
    !ID_PATTERN.test(value)
  ) {
    throw new DeviceProfileError(
      "INVALID_DEVICE_IDENTIFIER",
      `Invalid ${field}`
    );
  }

  return value;
}

function requireText(value, field) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_TEXT_LENGTH ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new DeviceProfileError(
      "INVALID_DEVICE_FIELD",
      `Invalid ${field}`
    );
  }

  return value;
}

function requireRestaurantId(value) {
  if (
    typeof value !== "string" ||
    !UUID_PATTERN.test(value)
  ) {
    throw new DeviceProfileError(
      "INVALID_RESTAURANT_ID",
      "Restaurant ID must be a UUID"
    );
  }

  return value.toLowerCase();
}

/**
 * Create a validated configuration profile.
 *
 * Never accept this profile alone as proof
 * that hardware is certified or authorized.
 *
 * restaurantId must be checked against
 * authenticated server-side identity.
 */
export function validateDeviceProfile(input) {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new DeviceProfileError(
      "INVALID_DEVICE_PROFILE",
      "Device profile must be an object"
    );
  }

  const deviceId = requireId(
    input.deviceId,
    "deviceId"
  );

  const driverId = requireId(
    input.driverId,
    "driverId"
  );

  const manufacturer = requireText(
    input.manufacturer,
    "manufacturer"
  );

  const model = requireText(
    input.model,
    "model"
  );

  const protocol = requireText(
    input.protocol,
    "protocol"
  );

  const restaurantId = requireRestaurantId(
    input.restaurantId
  );

  const environment = input.environment;

  if (
    environment !== "test" &&
    environment !== "production"
  ) {
    throw new DeviceProfileError(
      "INVALID_ENVIRONMENT",
      "Invalid device environment"
    );
  }

  const enabled = input.enabled;

  if (typeof enabled !== "boolean") {
    throw new DeviceProfileError(
      "INVALID_ENABLED_FLAG",
      "enabled must be boolean"
    );
  }

  return Object.freeze({
    deviceId,
    driverId,
    manufacturer,
    model,
    protocol,
    restaurantId,
    environment,
    enabled,

    // Validation is not authorization.
    validated: true,
    connectionAuthorized: false,
    printingAuthorized: false,
    fiscalCertified: false,
  });
}
