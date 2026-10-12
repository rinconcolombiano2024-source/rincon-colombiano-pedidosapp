import { createDefaultFiscalRegistry } from "../../fiscal-bridge/src/driver-registry.mjs";
import { NovitusNoviApiDriver } from "./drivers/novitus-noviapi.mjs";
import { PosnetDriver, ElzabDriver } from "./drivers/not-implemented.mjs";

export function createAgentRegistry() {
  const registry = createDefaultFiscalRegistry(); // incluye "mock"
  registry.register("novitus-noviapi", (o) => new NovitusNoviApiDriver(o));
  registry.register("posnet", (o) => new PosnetDriver(o));
  registry.register("elzab", (o) => new ElzabDriver(o));
  return registry;
}
