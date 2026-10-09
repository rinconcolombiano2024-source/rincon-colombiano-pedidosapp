
import {
  requireUuid,
  FiscalError,
} from "./fiscal-contract.mjs";

import {
  validateDeviceProfile,
} from "./device-profile.mjs";

import {
  createDefaultFiscalRegistry,
} from "./driver-registry.mjs";

/**
 * RC ORDERA — Device Resolver V1.0
 *
 * Resolución segura de perfiles fiscales.
 *
 * - Compatible con el registro existente.
 * - Aislamiento por restaurante.
 * - Denegación predeterminada.
 * - Sin conexión física.
 * - Sin impresión.
 * - Sin consultas, polling ni timers.
 *
 * NO es una autorización fiscal de producción.
 */

export function resolveFiscalDevice({
  profile,
  trustedRestaurantId,
  registry = createDefaultFiscalRegistry(),
} = {}) {

  const restaurantId = requireUuid(
    trustedRestaurantId,
    "trustedRestaurantId"
  );

  const device = validateDeviceProfile(
    profile
  );

  if (device.restaurantId !== restaurantId) {
    throw new FiscalError(
      "RESTAURANT_DEVICE_MISMATCH",
      "Device belongs to another restaurant"
    );
  }

  if (!registry ||
      typeof registry.supportedDrivers !== "function") {
    throw new FiscalError(
      "INVALID_REGISTRY",
      "Invalid fiscal driver registry"
    );
  }

  const supported = registry.supportedDrivers();

  if (
    !Array.isArray(supported) ||
    !supported.includes(device.driverId)
  ) {
    throw new FiscalError(
      "UNSUPPORTED_FISCAL_DEVICE",
      "Fiscal driver is not registered"
    );
  }

  // El perfil puede existir, pero eso no
  // permite conectar ni imprimir.
  //
  // La autorización final necesitará:
  // - identidad autenticada del agente
  // - registro persistente del dispositivo
  // - verificación de sede
  // - tabla VAT validada
  // - operación fiscal reclamada
  // - protocolo oficial del fabricante
  // - conciliación persistente

  return Object.freeze({
    restaurantId,
    deviceId: device.deviceId,
    driverId: device.driverId,
    manufacturer: device.manufacturer,
    model: device.model,
    protocol: device.protocol,
    environment: device.environment,
    enabled: device.enabled,

    profileValidated: true,
    driverRegistered: true,

    connectionAuthorized: false,
    printingAuthorized: false,
    fiscalCertified: false,

    status: "CONFIGURATION_RESOLVED",
  });
}
