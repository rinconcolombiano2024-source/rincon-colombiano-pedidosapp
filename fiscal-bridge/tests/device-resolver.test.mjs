
import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveFiscalDevice,
} from "../src/device-resolver.mjs";

const RESTAURANT =
  "11111111-1111-4111-8111-111111111111";

const OTHER_RESTAURANT =
  "22222222-2222-4222-8222-222222222222";

function profile(overrides = {}) {
  return {
    deviceId: "posnet_01",
    driverId: "mock",
    manufacturer: "POSNET",
    model: "TEST ONLY",
    protocol: "SIMULATION",
    restaurantId: RESTAURANT,
    environment: "test",
    enabled: false,
    ...overrides,
  };
}

test(
  "Resolves registered simulation device",
  () => {
    const result = resolveFiscalDevice({
      profile: profile(),
      trustedRestaurantId: RESTAURANT,
    });

    assert.equal(result.profileValidated, true);
    assert.equal(result.driverRegistered, true);
    assert.equal(result.printingAuthorized, false);
    assert.equal(result.connectionAuthorized, false);
    assert.equal(result.fiscalCertified, false);
    assert.equal(
      result.status,
      "CONFIGURATION_RESOLVED"
    );
  }
);

test(
  "Rejects device from another restaurant",
  () => {
    assert.throws(
      () => resolveFiscalDevice({
        profile: profile(),
        trustedRestaurantId: OTHER_RESTAURANT,
      }),
      { code: "RESTAURANT_DEVICE_MISMATCH" }
    );
  }
);

test(
  "Rejects unregistered physical driver",
  () => {
    assert.throws(
      () => resolveFiscalDevice({
        profile: profile({
          driverId: "posnet",
        }),
        trustedRestaurantId: RESTAURANT,
      }),
      { code: "UNSUPPORTED_FISCAL_DEVICE" }
    );
  }
);

test(
  "Enabled profile never authorizes printing",
  () => {
    const result = resolveFiscalDevice({
      profile: profile({
        enabled: true,
        environment: "production",
      }),
      trustedRestaurantId: RESTAURANT,
    });

    assert.equal(result.enabled, true);
    assert.equal(result.printingAuthorized, false);
    assert.equal(result.connectionAuthorized, false);
    assert.equal(result.fiscalCertified, false);
  }
);

test(
  "Resolution result is immutable",
  () => {
    const result = resolveFiscalDevice({
      profile: profile(),
      trustedRestaurantId: RESTAURANT,
    });

    assert.equal(Object.isFrozen(result), true);

    assert.throws(() => {
      result.printingAuthorized = true;
    }, TypeError);
  }
);
