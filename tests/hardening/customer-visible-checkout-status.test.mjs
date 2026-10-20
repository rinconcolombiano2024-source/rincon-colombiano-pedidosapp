import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../../cliente.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../../cliente.js", import.meta.url), "utf8");

test("customer checkout has an accessible status inside the open cart dialog", () => {
  const cart = html.match(/<section\s+class="customer-cart-panel[\s\S]*?<\/section>/);
  assert.ok(cart, "Cart dialog must exist");
  assert.match(cart[0], /id="customerCheckoutStatus"[^>]*role="(?:status|alert)"/);
});

test("checkout status updates are mirrored to the visible cart and remain text-only", () => {
  const fn = js.match(/function customerSetStatus\(message, type = ""\) \{[\s\S]*?\n\}/);
  assert.ok(fn);
  assert.match(fn[0], /customerCheckoutStatus/);
  assert.match(fn[0], /textContent\s*=\s*message/);
  assert.doesNotMatch(fn[0], /innerHTML\s*=/);
});
