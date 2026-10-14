import test from "node:test";
import assert from "node:assert/strict";
import { pick } from "../../delivery-bridge/src/canonical.mjs";

test("pick reads own nested fields used by delivery adapters", () => {
  assert.equal(pick({order:{id:"123"}}, "order.id"), "123");
  assert.equal(pick({order:{id:0}}, "order.id"), 0);
  assert.equal(pick({order:null}, "order.id"), undefined);
});

test("pick does not traverse prototype or constructor paths", () => {
  const inherited = Object.create({secret:"inherited"});
  inherited.order = {id:"ok"};
  assert.equal(pick(inherited, "secret"), undefined);
  assert.equal(pick(inherited, "order.id"), "ok");
  for (const path of ["__proto__", "constructor", "constructor.prototype", "order.__proto__", "order.constructor"]) {
    assert.equal(pick({order:{id:"ok"}}, path), undefined, path);
  }
});

test("pick safely handles null-prototype objects", () => {
  const obj = Object.create(null);
  obj.order = Object.assign(Object.create(null), {id:"safe"});
  assert.equal(pick(obj, "order.id"), "safe");
});
