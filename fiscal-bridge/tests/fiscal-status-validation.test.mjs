import test from "node:test";
import assert from "node:assert/strict";
import { FiscalService } from "../src/fiscal-service.mjs";

function serviceWithStatus(status) {
  return new FiscalService({
    create() {
      return {
        async connect() { return { connected: true, simulated: true }; },
        async getStatus() { return status; },
        async disconnect() { return { connected: false }; },
      };
    },
  });
}

for (const bad of [null, undefined, true, "connected", [], {}, { connected: "true" }, { connected: 1 }]) {
  test("rejects malformed fiscal device status: " + String(bad), async () => {
    const service = serviceWithStatus(bad);
    await service.connect("mock");
    await assert.rejects(service.getStatus(), { code: "INVALID_DEVICE_STATUS" });
    assert.deepEqual(await service.disconnect(), { connected: false });
  });
}

test("preserves valid connected and disconnected device readings", async () => {
  for (const connected of [true, false]) {
    const service = serviceWithStatus({ connected, simulated: true });
    await service.connect("mock");
    assert.deepEqual(await service.getStatus(), { connected, simulated: true });
    await service.disconnect();
  }
});
