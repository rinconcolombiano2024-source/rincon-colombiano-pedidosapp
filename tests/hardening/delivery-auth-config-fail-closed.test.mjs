import test from "node:test";
import assert from "node:assert/strict";
import { verifyWith } from "../../delivery-bridge/src/canonical.mjs";

const secret = "webhook-secret-of-sufficient-length";
const request = { headers: { authorization: secret }, rawBody: "{}" };

test("malformed webhook scheme fails closed rather than throwing", () => {
  for (const scheme of [null, undefined, false, 0, "static-token", [], 42]) {
    assert.doesNotThrow(() => verifyWith(scheme, request, secret));
    assert.equal(verifyWith(scheme, request, secret), false);
  }
});

test("non-string secrets cannot authorize a webhook", () => {
  const scheme = { type: "static-token", header: "authorization" };
  for (const candidate of [null, undefined, 1234567890123456, {}, [], true]) {
    assert.equal(verifyWith(scheme, request, candidate), false);
  }
  assert.equal(verifyWith(scheme, request, secret), true);
});
