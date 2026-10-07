const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(
  __dirname,
  "..",
);

const workerPath = path.join(
  repoRoot,
  "supabase",
  "functions",
  "marketplace-refund-reversals",
  "index.ts",
);

const webhookPath = path.join(
  repoRoot,
  "supabase",
  "functions",
  "marketplace-webhook",
  "index.ts",
);

const migrationPath = path.join(
  repoRoot,
  "MIGRACION-V91-09-CONCILIACION-REEMBOLSOS.sql",
);

const workerSource = fs.readFileSync(
  workerPath,
  "utf8",
);

const webhookSource = fs.readFileSync(
  webhookPath,
  "utf8",
);

const migrationSource = fs.readFileSync(
  migrationPath,
  "utf8",
);

test(
  "refund reversal worker is bounded and does not introduce polling",
  () => {
    assert.match(
      workerSource,
      /MAX_JOBS_PER_RUN\s*=\s*25/,
    );

    assert.match(
      workerSource,
      /MAX_AUTOMATIC_ATTEMPTS\s*=\s*6/,
    );

    assert.match(
      workerSource,
      /rc_ordera_claim_refund_reversals/,
    );

    assert.match(
      workerSource,
      /slice\s*\(\s*0,\s*MAX_JOBS_PER_RUN\s*,?\s*\)/s,
    );

    assert.doesNotMatch(
      workerSource,
      /\bsetInterval\s*\(/,
    );

    assert.doesNotMatch(
      workerSource,
      /\bsetTimeout\s*\([^,]+,\s*0\s*\)/,
    );
  },
);

test(
  "refund reversal queue remains indexed, leased and concurrency-safe",
  () => {
    assert.match(
      migrationSource,
      /marketplace_refund_reversals_due_idx/,
    );

    assert.match(
      migrationSource,
      /order\s+by\s+available_at\s+limit\s+25\s+for\s+update\s+skip\s+locked/i,
    );

    assert.match(
      migrationSource,
      /lease_token\s*=\s*gen_random_uuid\s*\(\s*\)/i,
    );

    assert.match(
      migrationSource,
      /available_at\s*=\s*now\s*\(\s*\)\s*\+\s*interval\s*'10 minutes'/i,
    );

    assert.match(
      migrationSource,
      /status\s+in\s*\(\s*'pending'\s*,\s*'processing'\s*,\s*'failed'\s*\)/i,
    );
  },
);

test(
  "refund reversal worker authenticates internal callers without direct secret equality",
  () => {
    assert.match(
      workerSource,
      /async function constantTimeEqual\s*\(/,
    );

    assert.match(
      workerSource,
      /crypto\.subtle\.digest\s*\(\s*"SHA-256"/,
    );

    assert.match(
      workerSource,
      /PAYMENT_SETTLEMENT_SECRET/,
    );

    assert.match(
      workerSource,
      /x-rc-ordera-settlement-secret/,
    );

    assert.match(
      workerSource,
      /constantTimeEqual\(\s*authorization,\s*`Bearer\s+\$\{serviceKey\}`\s*,?\s*\)/s,
    );

    assert.doesNotMatch(
      workerSource,
      /suppliedSecret\s*===\s*financialWorkerSecret/,
    );

    assert.doesNotMatch(
      workerSource,
      /authorization\s*===\s*`Bearer\s+\$\{serviceKey\}`/,
    );
  },
);

test(
  "Stripe transfer reversal is idempotent and reconciled before creation",
  () => {
    assert.match(
      workerSource,
      /listStripeTransferReversals\s*\(/,
    );

    assert.match(
      workerSource,
      /validateTransfer\s*\(/,
    );

    assert.match(
      workerSource,
      /validateReversal\s*\(/,
    );

    assert.match(
      workerSource,
      /amount_reversed/,
    );

    assert.match(
      workerSource,
      /"Idempotency-Key":\s*`rc-refund-reversal:\$\{queueId\}`/,
    );

    assert.match(
      workerSource,
      /\/transfers\/\$\{encodeURIComponent\(\s*transferId,\s*\)\}\/reversals/,
    );

    assert.match(
      workerSource,
      /metadata\[rc_ordera_reversal_id\]/,
    );

    assert.match(
      workerSource,
      /metadata\[payment_transaction_id\]/,
    );
  },
);

test(
  "refund reversal amount is reserved before external money movement",
  () => {
    assert.match(
      workerSource,
      /rc_ordera_reserve_refund_reversal_amount/,
    );

    assert.match(
      workerSource,
      /p_amount_minor:\s*expectedAmountMinor/,
    );

    assert.match(
      workerSource,
      /amountMinor\s*>\s*expectedAmountMinor/,
    );

    const reserveIndex = workerSource.indexOf(
      '"rc_ordera_reserve_refund_reversal_amount"',
    );

    const reversalIndex = workerSource.indexOf(
      "await createStripeTransferReversal(",
    );

    assert.ok(
      reserveIndex >= 0,
      "reserve RPC must exist",
    );

    assert.ok(
      reversalIndex >= 0,
      "Stripe reversal call must exist",
    );

    assert.ok(
      reserveIndex < reversalIndex,
      "amount must be reserved before creating a Stripe reversal",
    );
  },
);

test(
  "refund reversal failures stop after bounded retries and move to manual review",
  () => {
    assert.match(
      workerSource,
      /MAX_AUTOMATIC_ATTEMPTS\s*=\s*6/,
    );

    assert.match(
      workerSource,
      /attempts\s*<\s*MAX_AUTOMATIC_ATTEMPTS/,
    );

    assert.match(
      workerSource,
      /"manual_review"/,
    );

    assert.match(
      workerSource,
      /rc_ordera_finish_refund_reversal/,
    );
  },
);

test(
  "webhook dispatches refund reversal worker only after a verified total refund",
  () => {
    assert.match(
      webhookSource,
      /function scheduleRefundReversalWorker\s*\(/,
    );

    assert.match(
      webhookSource,
      /EdgeRuntime\.waitUntil\s*\(/,
    );

    assert.match(
      webhookSource,
      /functions\/v1\/marketplace-refund-reversals/,
    );

    assert.match(
      webhookSource,
      /paymentTransactionId/,
    );

    assert.match(
      webhookSource,
      /Authorization:\s*`Bearer\s+\$\{serviceKey\}`/,
    );

    assert.match(
      webhookSource,
      /PAYMENT_SETTLEMENT_SECRET/,
    );

    assert.match(
      webhookSource,
      /String\(\s*refund\.data\s*\|\|\s*""\s*,?\s*\)\.toLowerCase\(\)\s*===\s*"refunded"/s,
    );

    assert.match(
      webhookSource,
      /refundBecameTotal/,
    );

    assert.doesNotMatch(
      webhookSource,
      /\/transfers\/.*\/reversals/,
    );
  },
);

test(
  "verified refund RPC queues only total-refund transfer reversals",
  () => {
    assert.match(
      migrationSource,
      /create\s+or\s+replace\s+function\s+public\.rc_ordera_record_verified_refund/i,
    );

    assert.match(
      migrationSource,
      /new\.refund_amount\s*<\s*new\.gross_amount/i,
    );

    assert.match(
      migrationSource,
      /on\s+conflict\s*\(\s*transfer_id\s*\)\s+do\s+nothing/i,
    );

    assert.match(
      migrationSource,
      /rc_ordera_queue_refund_reversals/i,
    );

    assert.match(
      migrationSource,
      /grant\s+execute\s+on\s+function\s+public\.rc_ordera_claim_refund_reversals\(uuid\)\s+to\s+service_role/i,
    );

    assert.match(
      migrationSource,
      /revoke\s+all\s+on\s+function\s+public\.rc_ordera_claim_refund_reversals\(uuid\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i,
    );
  },
);
