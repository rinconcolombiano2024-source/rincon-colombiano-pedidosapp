const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const checkoutPath = path.join(
  __dirname,
  "..",
  "supabase",
  "functions",
  "marketplace-checkout",
  "index.ts",
);

const source = fs.readFileSync(
  checkoutPath,
  "utf8",
);

test(
  "checkout bounds and validates external input before database access",
  () => {
    assert.match(
      source,
      /MAX_REQUEST_BODY_BYTES\s*=\s*16_384/,
    );

    assert.match(
      source,
      /MAX_PUBLIC_TOKEN_LENGTH\s*=\s*512/,
    );

    assert.match(
      source,
      /MAX_AUTHORIZATION_HEADER_LENGTH\s*=\s*8_192/,
    );

    assert.match(
      source,
      /function isUuid\s*\(/,
    );

    assert.match(
      source,
      /readJsonBodyLimited\s*\(/,
    );
  },
);

test(
  "checkout requires a valid Stripe Connect payout account before creating a session",
  () => {
    assert.match(
      source,
      /function isValidStripeAccountId\s*\(/,
    );

    assert.match(
      source,
      /\/\^acct_\[A-Za-z0-9\]\+\$\//,
    );

    assert.match(
      source,
      /payoutAccount\.onboarding_status\s*!==\s*"complete"/,
    );

    assert.match(
      source,
      /!payoutAccount\.payouts_enabled/,
    );
  },
);

test(
  "checkout preserves database and Stripe idempotency",
  () => {
    assert.match(
      source,
      /`stripe-checkout:\$\{order\.id\}:\$\{attemptNumber\}`/,
    );

    assert.match(
      source,
      /"Idempotency-Key":\s*idempotencyKey/,
    );

    assert.match(
      source,
      /reserveError\.code\s*!==\s*"23505"/,
    );

    assert.match(
      source,
      /Payment provider response is pending\. Retry safely\./,
    );
  },
);

test(
  "successful Stripe session is reconciled before it is persisted",
  () => {
    assert.match(
      source,
      /function validateCheckoutSession\s*\(/,
    );

    assert.match(
      source,
      /session\?\.object\s*!==\s*"checkout\.session"/,
    );

    assert.match(
      source,
      /session\?\.mode\s*!==\s*"payment"/,
    );

    assert.match(
      source,
      /amountTotal\s*!==\s*expected\.amountMinor/,
    );

    assert.match(
      source,
      /currency\s*!==\s*expected\.currency/,
    );

    assert.match(
      source,
      /clientReferenceId\s*!==\s*expected\.orderId/,
    );

    assert.match(
      source,
      /metadataTransactionId\s*!==\s*expected\.transactionId/,
    );

    assert.match(
      source,
      /metadataOrderId\s*!==\s*expected\.orderId/,
    );
  },
);

test(
  "checkout URL must stay on Stripe hosted Checkout",
  () => {
    assert.match(
      source,
      /url\.hostname\s*===\s*"checkout\.stripe\.com"/,
    );

    assert.match(
      source,
      /url\.protocol\s*===\s*"https:"/,
    );

    assert.match(
      source,
      /Stored checkout requires reconciliation before another payment attempt/,
    );
  },
);

test(
  "checkout does not open a new payment for incompatible financial states",
  () => {
    assert.match(
      source,
      /Order is already paid/,
    );

    assert.match(
      source,
      /Order payment state does not allow a new checkout/,
    );

    assert.match(
      source,
      /\[\s*""\,\s*"pending"\,\s*"failed"\,\s*\]\.includes/s,
    );
  },
);
