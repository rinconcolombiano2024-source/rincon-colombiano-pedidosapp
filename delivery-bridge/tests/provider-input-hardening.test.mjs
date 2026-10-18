import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProvider } from "../src/providers.mjs";

test("provider normalization never invokes user-controlled coercion", () => {
  let called = 0;
  const attacker = { toString() { called++; throw Error("EXECUTED"); }, valueOf() { called++; throw Error("EXECUTED"); } };
  for (const value of [attacker, Object.create(null), [], 0, true, Symbol("wolt"), null, undefined]) {
    assert.throws(() => normalizeProvider(value), { code: "UNSUPPORTED_PROVIDER" });
  }
  assert.equal(called, 0);
});

test("canonical providers and existing aliases retain compatibility", () => {
  for (const provider of ["wolt", "glovo", "uber_eats", "bolt_food", "pyszne"]) {
    assert.equal(normalizeProvider(provider), provider);
  }
  assert.equal(normalizeProvider("ubereats"), "uber_eats");
  assert.equal(normalizeProvider("boltfood"), "bolt_food");
  for (const invalid of ["__proto__", "constructor", "toString", "WOLT", " wolt", "wolt "]) {
    assert.throws(() => normalizeProvider(invalid), { code: "UNSUPPORTED_PROVIDER" });
  }
});
