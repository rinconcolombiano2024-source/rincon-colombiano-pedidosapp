import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProvider } from "../src/providers.mjs";
import { createDefaultDeliveryRegistry, createPreparedDeliveryRegistry } from "../src/adapter-registry.mjs";

const canonical = ["uber_eats", "wolt", "glovo", "bolt_food", "pyszne"];

test("all declared delivery providers resolve to canonical identifiers", () => {
  for (const id of canonical) assert.equal(normalizeProvider(id), id);
  assert.equal(normalizeProvider("ubereats"), "uber_eats");
  assert.equal(normalizeProvider("boltfood"), "bolt_food");
});

test("unsupported delivery providers and malformed identifiers fail closed", () => {
  for (const id of [null, undefined, "", "nequi", "Uber Eats", "../wolt", "wolt ", "constructor", "__proto__"]) {
    assert.throws(() => normalizeProvider(id), { code: "UNSUPPORTED_PROVIDER" });
  }
});

test("prepared adapters do not enable any provider in the default live registry", () => {
  assert.deepEqual(createDefaultDeliveryRegistry().supportedProviders(), []);
  const prepared = createPreparedDeliveryRegistry();
  assert.deepEqual([...prepared.supportedProviders()].sort(), [...canonical].sort());
  for (const id of canonical) {
    assert.throws(() => createDefaultDeliveryRegistry().create(id), { code: "UNSUPPORTED_PROVIDER" });
  }
});
