
import test from "node:test";
import assert from "node:assert/strict";

import {
  DeliveryAdapterRegistry,
} from "../src/adapter-registry.mjs";

import {
  VerifiedDeliveryIntake,
} from "../src/verified-intake.mjs";

/**
 * RC ORDERA — Provider Isolation Regression V1
 *
 * No importa pedidos.
 * No imprime recibos fiscales.
 * No escribe en Supabase.
 * No ejecuta polling ni temporizadores.
 */

const RESTAURANT =
  "11111111-1111-4111-8111-111111111111";

const OTHER_RESTAURANT =
  "22222222-2222-4222-8222-222222222222";

function validOrder(overrides = {}) {
  return {
    externalOrderId: "order-100",
    externalEventId: "event-100",
    eventType: "new",
    sourceStatus: "new",
    currency: "PLN",
    items: [
      {
        productId: "bandeja",
        quantity: 2,
        unitPriceGrosz: 6000,
        lineTotalGrosz: 12000,
      },
    ],
    deliveryFeeGrosz: 0,
    serviceFeeGrosz: 0,
    discountGrosz: 0,
    totalGrosz: 12000,
    ...overrides,
  };
}

function createIntake({
  verified = true,
  order = validOrder(),
} = {}) {
  const registry =
    new DeliveryAdapterRegistry();

  registry.register(
    "rc_test",
    () => ({
      async verify() {
        return verified;
      },

      async normalize() {
        return order;
      },
    })
  );

  return new VerifiedDeliveryIntake(
    registry
  );
}

function request(overrides = {}) {
  return {
    trustedRestaurantId: RESTAURANT,
    providerId: "rc_test",
    rawBody: new TextEncoder().encode(
      '{"event":"test"}'
    ),
    headers: {},
    ...overrides,
  };
}

test(
  "Authenticated event remains under review",
  async () => {
    const intake = createIntake();

    const result = await intake.prepare(
      request()
    );

    assert.equal(result.verified, true);
    assert.equal(result.arithmeticValid, true);
    assert.equal(result.reviewRequired, true);
    assert.equal(result.importAllowed, false);
    assert.equal(
      result.fiscalPrintAllowed,
      false
    );
    assert.equal(result.totalGrosz, 12000);
  }
);

test(
  "Unverified provider cannot import orders",
  async () => {
    const intake = createIntake({
      verified: false,
    });

    await assert.rejects(
      intake.prepare(request()),
      { code: "UNVERIFIED_MESSAGE" }
    );
  }
);

test(
  "Rejects another restaurant identity",
  async () => {
    const intake = createIntake({
      order: validOrder({
        restaurantId: OTHER_RESTAURANT,
      }),
    });

    await assert.rejects(
      intake.prepare(request()),
      { code: "TENANT_SCOPE_MISMATCH" }
    );
  }
);

test(
  "Rejects provider identity mismatch",
  async () => {
    const intake = createIntake({
      order: validOrder({
        providerId: "another_provider",
      }),
    });

    await assert.rejects(
      intake.prepare(request()),
      { code: "PROVIDER_SCOPE_MISMATCH" }
    );
  }
);

test(
  "Rejects changed financial total",
  async () => {
    const intake = createIntake({
      order: validOrder({
        totalGrosz: 11999,
      }),
    });

    await assert.rejects(
      intake.prepare(request()),
      { code: "ORDER_TOTAL_MISMATCH" }
    );
  }
);

test(
  "Unknown provider is not accepted",
  async () => {
    const intake = createIntake();

    await assert.rejects(
      intake.prepare(
        request({
          providerId: "unregistered",
        })
      ),
      { code: "UNSUPPORTED_PROVIDER" }
    );
  }
);
