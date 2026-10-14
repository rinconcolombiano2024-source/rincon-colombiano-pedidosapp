import test from "node:test";
import assert from "node:assert/strict";
import { parseJson } from "../../delivery-bridge/src/canonical.mjs";

test("delivery JSON byte limit rejects multibyte UTF-8 payloads", () => {
  const body = JSON.stringify({ note: "sin cebolla 🌶️" });
  assert.ok(body.length < Buffer.byteLength(body, "utf8"));
  assert.throws(() => parseJson(body, body.length), { code: "INVALID_BODY" });
  assert.deepEqual(parseJson(body, Buffer.byteLength(body, "utf8")), { note: "sin cebolla 🌶️" });
});

test("delivery JSON byte limit accepts exact ASCII boundary", () => {
  const body = '{"id":1}';
  assert.deepEqual(parseJson(body, Buffer.byteLength(body)), { id: 1 });
  assert.throws(() => parseJson(body, Buffer.byteLength(body) - 1), { code: "INVALID_BODY" });
});

test("delivery JSON rejects invalid size limits", () => {
  for (const limit of [0, -1, NaN, Infinity, 1.5]) {
    assert.throws(() => parseJson('{"ok":true}', limit), { code: "INVALID_BODY" });
  }
});
