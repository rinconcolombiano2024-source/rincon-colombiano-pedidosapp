import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWith } from "../../delivery-bridge/src/canonical.mjs";

const secret = "test-webhook-secret-32-bytes-long";
const sign = (bytes) => createHmac("sha256", secret).update(bytes).digest("hex");

test("HMAC authenticates exact UTF-8 bytes from native Headers", () => {
  const rawBody = new TextEncoder().encode('{"note":"sin cebolla ñ ☕"}');
  const headers = new Headers({ "X-Signature": sign(rawBody) });
  const scheme = { type: "hmac-sha256", header: "x-signature", encoding: "hex" };
  assert.equal(verifyWith(scheme, { headers, rawBody }, secret), true);
  assert.equal(verifyWith(scheme, { headers: { "X-SIGNATURE": sign(rawBody) }, rawBody }, secret), true);
  assert.equal(verifyWith(scheme, { headers, rawBody: new Uint8Array([...rawBody, 32]) }, secret), false);
  assert.equal(verifyWith(scheme, { headers, rawBody: { toString: () => "malicious" } }, secret), false);
});

test("timestamped HMAC signs timestamp and raw bytes, rejects expired or altered payloads", () => {
  const now = 1800000000000;
  const timestamp = String(Math.floor(now / 1000));
  const body = new TextEncoder().encode('{"order":"ñ-123"}');
  const signed = Buffer.concat([Buffer.from(timestamp + "."), Buffer.from(body)]);
  const headers = new Headers({ "X-Signature": sign(signed), "X-Timestamp": timestamp });
  const scheme = { type: "hmac-sha256", header: "x-signature", timestampHeader: "x-timestamp", toleranceSeconds: 300 };
  assert.equal(verifyWith(scheme, { headers, rawBody: body, now }, secret), true);
  assert.equal(verifyWith(scheme, { headers, rawBody: body, now: now + 301000 }, secret), false);
  const altered = new Uint8Array(body);
  altered[1] ^= 1;
  assert.equal(verifyWith(scheme, { headers, rawBody: altered, now }, secret), false);
});

test("static token accepts Headers case-insensitively and rejects altered token", () => {
  const scheme = { type: "static-token", header: "authorization" };
  assert.equal(verifyWith(scheme, { headers: new Headers({ Authorization: secret }), rawBody: "{}" }, secret), true);
  assert.equal(verifyWith(scheme, { headers: { AUTHORIZATION: secret }, rawBody: "{}" }, secret), true);
  assert.equal(verifyWith(scheme, { headers: new Headers({ Authorization: secret + "x" }), rawBody: "{}" }, secret), false);
});
