
import test from "node:test";
import assert from "node:assert/strict";

import {
  validateDeviceProfile,
} from "../src/device-profile.mjs";

/**
 * RC ORDERA — Fiscal Device Profile QA V1
 *
 * Tests for:
 * - Device identity
 * - Manufacturer and model
 * - Restaurant isolation
 * - Environment validation
 * - Authorization defaults
 * - Immutable configuration
 *
 * No physical hardware.
 * No database writes.
 * No network connections.
 * No polling or timers.
 */

const RESTAURANT_ID =
  "11111111-1111-4111-8111-111111111111";

function profile(overrides = {}) {
  return {
    deviceId: "posnet_01",
    driverId: "posnet",
    manufacturer: "POSNET",
    model: "TEST MODEL",
    protocol: "TEST_PROTOCOL",
    restaurantId: RESTAURANT_ID,
    environment: "test",
    enabled: false,
    ...overrides,
  };
}

test(
  "Accepts valid device configuration",
  () => {
    const result = validateDeviceProfile(
      profile()
    );

    assert.equal(result.validated, true);

    assert.equal(
      result.restaurantId,
      RESTAURANT_ID
    );

    assert.equal(
      result.manufacturer,
      "POSNET"
    );

    assert.equal(
      result.connectionAuthorized,
      false
    );

    assert.equal(
      result.printingAuthorized,
      false
    );

    assert.equal(
      result.fiscalCertified,
      false
    );
  }
);

test(
  "Rejects invalid device identifiers",
  () => {
    for (const value of [
      "",
      "!",
      "POSNET SPACE",
      null,
      undefined,
      123,
    ]) {
      assert.throws(
        () => validateDeviceProfile(
          profile({ deviceId: value })
        ),
        {
          code: "INVALID_DEVICE_IDENTIFIER",
        }
      );
    }
  }
);

test(
  "Rejects invalid restaurant identity",
  () => {
    assert.throws(
      () => validateDeviceProfile(
        profile({
          restaurantId: "invalid",
        })
      ),
      {
        code: "INVALID_RESTAURANT_ID",
      }
    );
  }
);

test(
  "Rejects invalid device environment",
  () => {
    assert.throws(
      () => validateDeviceProfile(
        profile({
          environment: "unknown",
        })
      ),
      {
        code: "INVALID_ENVIRONMENT",
      }
    );
  }
);

test(
  "Rejects nonboolean enabled flag",
  () => {
    assert.throws(
      () => validateDeviceProfile(
        profile({
          enabled: "true",
        })
      ),
      {
        code: "INVALID_ENABLED_FLAG",
      }
    );
  }
);

test(
  "Rejects malformed manufacturer data",
  () => {
    assert.throws(
      () => validateDeviceProfile(
        profile({
          manufacturer: "POSNET\nINJECTED",
        })
      ),
      {
        code: "INVALID_DEVICE_FIELD",
      }
    );
  }
);

test(
  "Cannot grant fiscal authorization",
  () => {
    const result = validateDeviceProfile(
      profile({
        enabled: true,
        environment: "production",
        printingAuthorized: true,
        connectionAuthorized: true,
        fiscalCertified: true,
      })
    );

    assert.equal(result.enabled, true);

    assert.equal(
      result.printingAuthorized,
      false
    );

    assert.equal(
      result.connectionAuthorized,
      false
    );

    assert.equal(
      result.fiscalCertified,
      false
    );
  }
);

test(
  "Validated device profile is immutable",
  () => {
    const result = validateDeviceProfile(
      profile()
    );

    assert.equal(
      Object.isFrozen(result),
      true
    );

    assert.throws(
      () => {
        result.printingAuthorized = true;
      },
      TypeError
    );

    assert.equal(
      result.printingAuthorized,
      false
    );
  }
);

test(
  "Rejects malformed configuration",
  () => {
    for (const invalid of [
      null,
      [],
      "device",
      123,
    ]) {
      assert.throws(
        () => validateDeviceProfile(
          invalid
        ),
        {
          code: "INVALID_DEVICE_PROFILE",
        }
      );
    }
  }
);
