const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "functions", "marketplace-confirm-delivery", "index.ts"),
  "utf8",
);

test("confirm-delivery remains a real Supabase Edge Function", () => {
  assert.match(source, /import\s+\{\s*createClient\s*\}/);
  assert.match(source, /Deno\.serve\s*\(/);
  assert.doesNotMatch(source, /const\s+fs\s*=\s*require\(/);
  assert.doesNotMatch(source, /RC ORDERA V\$\{JSON\.parse/);
});

test("delivery confirmation validates bounded input and UUID", () => {
  assert.match(source, /MAX_REQUEST_BODY_BYTES\s*=\s*16_384/);
  assert.match(source, /MAX_PUBLIC_TOKEN_LENGTH\s*=\s*512/);
  assert.match(source, /function isUuid\s*\(/);
  assert.match(source, /actor === "courier" && !rawAuthorization/);
  assert.match(source, /actor === "customer" && !rawAuthorization && suppliedToken\.length < 8/);
});

test("authorization is enforced by the canonical delivery RPC", () => {
  assert.match(source, /\.rpc\("record_delivery_completion_confirmation"/);
  assert.match(source, /p_customer_order_id: orderId/);
  assert.match(source, /p_actor: actor/);
  assert.doesNotMatch(source, /\.from\("marketplace_payment_allocations"\)/);
  assert.doesNotMatch(source, /error:\s*error\.message/);
});

test("settlement trigger prefers least-privilege secret and has timeout", () => {
  assert.match(source, /PAYMENT_SETTLEMENT_SECRET/);
  assert.match(source, /x-rc-ordera-settlement-secret/);
  assert.match(source, /SETTLEMENT_REQUEST_TIMEOUT_MS\s*=\s*10_000/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /controller\.abort\(\)/);
});

test("settlement failure cannot erase a valid delivery confirmation", () => {
  assert.match(source, /let settlementRequested = false/);
  assert.match(source, /normalized\.settlementEligible/);
  assert.match(source, /return response\(200, \{/);
  assert.match(source, /settlementEligible: normalized\.settlementEligible/);
});
