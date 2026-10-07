const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const settlementPath = path.join(
  __dirname,
  "..",
  "supabase",
  "functions",
  "marketplace-settlement",
  "index.ts",
);

const source = fs.readFileSync(
  settlementPath,
  "utf8",
);

test(
  "settlement secrets are never compared with direct equality",
  () => {
    assert.match(
      source,
      /async function constantTimeEqual\s*\(/,
    );

    assert.match(
      source,
      /crypto\.subtle\.digest\s*\(\s*"SHA-256"/,
    );

    assert.doesNotMatch(
      source,
      /authorization\s*===\s*`Bearer\s+\$\{serviceKey\}`/,
    );

    assert.doesNotMatch(
      source,
      /suppliedSecret\s*===\s*settlementSecret/,
    );
  },
);

test(
  "Stripe transfer keeps idempotency and has a hard timeout",
  () => {
    assert.match(
      source,
      /"Idempotency-Key":\s*idempotencyKey/,
    );

    assert.match(
      source,
      /STRIPE_REQUEST_TIMEOUT_MS\s*=\s*15_000/,
    );

    assert.match(
      source,
      /new AbortController\s*\(\s*\)/,
    );

    assert.match(
      source,
      /controller\.abort\s*\(\s*\)/,
    );
  },
);

test(
  "Stripe transfer response is reconciled with the requested transfer",
  () => {
    assert.match(
      source,
      /returnedAmount\s*!==\s*minorAmount/,
    );

    assert.match(
      source,
      /returnedCurrency\s*!==\s*normalizedCurrency/,
    );

    assert.match(
      source,
      /returnedDestination\s*!==\s*destination/,
    );

    assert.match(
      source,
      /\/\^tr_\[A-Za-z0-9\]\+\$\//,
    );
  },
);

test(
  "settlement still preserves deterministic transfer idempotency keys",
  () => {
    assert.match(
      source,
      /`restaurant:\$\{allocation\.id\}`/,
    );

    assert.match(
      source,
      /`courier:\$\{allocation\.id\}`/,
    );
  },
);
