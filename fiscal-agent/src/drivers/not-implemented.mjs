/**
 * Marcas con protocolo propietario que NO se pueden implementar sin su documentación oficial
 * y una impresora física: se registran para fallar cerrado y dejar claro qué falta.
 */
import { FiscalDriver, FiscalError } from "../../../fiscal-bridge/src/fiscal-contract.mjs";

export function createPendingDriver(brand, requirement) {
  return class PendingFiscalDriver extends FiscalDriver {
    constructor() {
      super();
      throw new FiscalError("DRIVER_NOT_IMPLEMENTED", `${brand}: ${requirement}`);
    }
  };
}
export const PosnetDriver = createPendingDriver("Posnet", "falta el manual oficial del protocolo, el modelo exacto y una unidad de pruebas");
export const ElzabDriver = createPendingDriver("Elzab", "falta el manual oficial del protocolo, el modelo exacto y una unidad de pruebas");
