
import test from "node:test";
import assert from "node:assert/strict";

import {
  DeliveryAdapterRegistry,
  createDefaultDeliveryRegistry,
} from "../src/adapter-registry.mjs";

import {
  VerifiedDeliveryIntake,
} from "../src/verified-intake.mjs";

const RESTAURANT =
  "22222222-2222-4222-8222-222222222222";

const OTHER =
  "99999999-9999-4999-8999-999999999999";

const rawBody = new TextEncoder().encode(
  '{"test":true}'
);

function order(changes = {}) {
  return {
    externalOrderId: "order-42",
    externalEventId: "event-42",
    eventType: "new",
    sourceStatus: "new",
    currency: "PLN",
    totalGrosz: 3400,

    items: [
      {
        productId: "item_1",
        quantity: 2,
        unitPriceGrosz: 1200,
        lineTotalGrosz: 2400,
      },
      {
        productId: "item_2",
        quantity: 1,
        unitPriceGrosz: 1000,
        lineTotalGrosz: 1000,
      },
    ],

    deliveryFeeGrosz: 400,
    serviceFeeGrosz: 100,
    discountGrosz: 500,

    ...changes,
  };
}

function setup({
  verify = async () => true,
  normalize = async () => order(),
} = {}) {
  const registry =
    new DeliveryAdapterRegistry();

  registry.register(
    "rc_test",
    () => ({
      verify,
      normalize,
    })
  );

  return new VerifiedDeliveryIntake(
    registry
  );
}

function request(changes = {}) {
  return {
    trustedRestaurantId: RESTAURANT,
    providerId: "rc_test",
    rawBody,
    headers: {
      "x-test": "abc",
    },
    ...changes,
  };
}

test(
  "Default registry fails closed",
  async () => {
    const service =
      new VerifiedDeliveryIntake(
        createDefaultDeliveryRegistry()
      );

    await assert.rejects(
      service.prepare(request()),
      {
        code: "UNSUPPORTED_PROVIDER",
      }
    );
  }
);

test(
  "Requires explicit verification",
  async () => {
    for (const unverified of [
      false,
      null,
      undefined,
      {},
      "true",
      1,
    ]) {
      let normalized = 0;

      const service = setup({
        verify: async () => unverified,

        normalize: () => {
          normalized++;
          return order();
        },
      });

      await assert.rejects(
        service.prepare(request()),
        {
          code: "UNVERIFIED_MESSAGE",
        }
      );

      assert.equal(normalized, 0);
    }
  }
);

test(
  "Verifier failure prevents normalization",
  async () => {
    let normalized = false;

    const service = setup({
      verify: () => {
        throw new Error("SECRET");
      },

      normalize: () => {
        normalized = true;
      },
    });

    await assert.rejects(
      service.prepare(request()),
      {
        code: "VERIFICATION_FAILED",
      }
    );

    assert.equal(normalized, false);
  }
);

test(
  "Rejects invalid message size",
  async () => {
    const service = setup();

    for (const bad of [
      new Uint8Array(0),
      new Uint8Array(65537),
      "{}",
      null,
    ]) {
      await assert.rejects(
        service.prepare(
          request({
            rawBody: bad,
          })
        ),
        {
          code: "INVALID_BODY",
        }
      );
    }
  }
);

test(
  "Verified order remains under review",
  async () => {
    const service = setup();

    const result =
      await service.prepare(request());

    assert.equal(
      result.verified,
      true
    );

    assert.equal(
      result.restaurantId,
      RESTAURANT
    );

    assert.equal(
      result.providerId,
      "rc_test"
    );

    assert.equal(
      result.totalGrosz,
      3400
    );

    assert.equal(
      result.reviewRequired,
      true
    );

    assert.equal(
      result.importAllowed,
      false
    );

    assert.equal(
      result.fiscalPrintAllowed,
      false
    );

    assert.equal(
      Object.isFrozen(result),
      true
    );

    assert.equal(
      Object.isFrozen(result.payload),
      true
    );
  }
);

test(
  "Rejects cross-restaurant identity",
  async () => {
    const service = setup({
      normalize: async () =>
        order({
          restaurantId: OTHER,
        }),
    });

    await assert.rejects(
      service.prepare(request()),
      {
        code: "TENANT_SCOPE_MISMATCH",
      }
    );
  }
);

test(
  "Rejects provider identity mismatch",
  async () => {
    const service = setup({
      normalize: async () =>
        order({
          providerId: "wolt",
        }),
    });

    await assert.rejects(
      service.prepare(request()),
      {
        code: "PROVIDER_SCOPE_MISMATCH",
      }
    );
  }
);

test(
  "Rejects incorrect order total",
  async () => {
    const service = setup({
      normalize: async () =>
        order({
          totalGrosz: 3401,
        }),
    });

    await assert.rejects(
      service.prepare(request()),
      {
        code: "ORDER_TOTAL_MISMATCH",
      }
    );
  }
);

test(
  "Rejects unvalidated modifiers",
  async () => {
    const product = {
      ...order().items[0],
      modifiers: [
        {
          id: "extra_cheese",
        },
      ],
    };

    const service = setup({
      normalize: async () =>
        order({
          items: [
            product,
            order().items[1],
          ],
        }),
    });

    await assert.rejects(
      service.prepare(request()),
      {
        code: "UNSUPPORTED_MODIFIERS",
      }
    );
  }
);

test(
  "Limits aggregate item quantity",
  async () => {
    const items = Array.from(
      {
        length: 51,
      },
      (_, i) => ({
        productId: `p${i}`,
        quantity: 2,
        unitPriceGrosz: 1,
        lineTotalGrosz: 2,
      })
    );

    const service = setup({
      normalize: async () =>
        order({
          items,
          totalGrosz: 102,
          deliveryFeeGrosz: 0,
          serviceFeeGrosz: 0,
          discountGrosz: 0,
        }),
    });

    await assert.rejects(
      service.prepare(request()),
      {
        code: "TOTAL_QUANTITY_EXCEEDED",
      }
    );
  }
);

test(
  "Verifier cannot mutate normalization input",
  async () => {
    const service = setup({
      verify: async ({
        rawBody,
        headers,
      }) => {
        rawBody.fill(0);

        headers.set(
          "x-test",
          "modified"
        );

        return true;
      },

      normalize: async ({
        rawBody,
        headers,
      }) => {
        assert.equal(
          new TextDecoder().decode(rawBody),
          '{"test":true}'
        );

        assert.equal(
          headers.get("x-test"),
          "abc"
        );

        return order();
      },
    });

    await service.prepare(request());
  }
);

test(
  "Malformed normalized results fail closed",
  async () => {
    await assert.rejects(
      setup({
        normalize: () => null,
      }).prepare(request()),
      {
        code: "INVALID_NORMALIZED_ORDER",
      }
    );

    await assert.rejects(
      setup({
        normalize: () => {
          throw new Error("private");
        },
      }).prepare(request()),
      {
        code: "NORMALIZATION_FAILED",
      }
    );
  }
);
