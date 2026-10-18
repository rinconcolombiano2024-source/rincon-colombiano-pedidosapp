import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const customer = readFileSync('cliente.js', 'utf8');
const androidCustomer = readFileSync('www/cliente.js', 'utf8');

test('web and packaged Android customer sources stay identical', () => {
  assert.equal(androidCustomer, customer, 'publish customer changes to both distributions');
});

test('each cart addition gets an independent line and editable note', () => {
  const add = customer.slice(customer.indexOf('function customerAddItem(dish) {'), customer.indexOf('function customerFindCurrentMenuProduct('));
  assert.match(add, /customerCart\.push\(\{/);
  assert.match(add, /id:\s*crypto\.randomUUID/);
  assert.match(add, /note:\s*""/);
  const render = customer.slice(customer.indexOf('function customerRenderCart() {'), customer.indexOf('function customerAddItem(dish) {'));
  assert.match(render, /data-action="note"/);
  assert.match(render, /maxlength="250"/);
  assert.match(render, /customerEscapeHtml\(\s*item\.note\s*\)/);
});

test('checkout serializes item notes independently in canonical and legacy fields', () => {
  const start = customer.indexOf('const items = customerCart.map((item) => {');
  assert.ok(start !== -1, 'checkout must map individual cart lines');
  const end = customer.indexOf('const total = customerCartTotal();', start);
  assert.ok(end > start, 'checkout total follows line serialization');
  const mapping = customer.slice(start, end);
  assert.match(mapping, /const itemNote = customerNormalizeNote\(item\.note\)/);
  assert.match(mapping, /options_snapshot:\s*\{[\s\S]*?note:\s*itemNote/);
  assert.match(mapping, /\bnote:\s*itemNote/);
  assert.match(mapping, /product_id:\s*item\.productId/);
  assert.match(mapping, /quantity,/);
  assert.match(mapping, /unit_price_snapshot:\s*unitPrice/);
});

test('product-note interface labels exist in Spanish, Polish and English', () => {
  for (const phrase of [
    'Observaciones para este producto',
    'Uwagi do tego produktu',
    'Instructions for this item'
  ]) {
    assert.ok(customer.includes(phrase), 'missing translation: ' + phrase);
  }
});
