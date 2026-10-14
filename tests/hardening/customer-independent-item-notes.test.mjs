import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('identical menu products retain independent cart notes without changing prices', () => {
  const source = readFileSync('cliente.js', 'utf8');
  const start = source.indexOf('function customerAddItem(dish) {');
  const end = source.indexOf('function customerFindCurrentMenuProduct(', start);
  assert.ok(start >= 0 && end > start, 'customerAddItem source exists');
  const cart = [];
  const context = {
    customerCheckoutBusy: false,
    customerCart: cart,
    customerActiveCategory: 'Bebidas',
    customerNormalizeProductId: value => String(value),
    customerStableProductId: () => 'stable',
    customerNormalizeProductStation: value => value || 'bar',
    customerRenderCart: () => {},
    crypto: { randomUUID: (() => { let id = 0; return () => 'line-' + ++id; })() },
    Number, Date, Math
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const dish = { id: 'juice', name: 'Jugo', price: 15, station: 'bar' };
  context.customerAddItem(dish);
  cart[0].note = 'Sin azúcar';
  context.customerAddItem(dish);
  cart[1].note = 'Sin hielo';
  assert.equal(cart.length, 2, 'same product must not be merged');
  assert.notEqual(cart[0].id, cart[1].id);
  assert.deepEqual(cart.map(x => x.note), ['Sin azúcar', 'Sin hielo']);
  assert.deepEqual(cart.map(x => x.price), [15, 15]);
  assert.deepEqual(cart.map(x => x.qty), [1, 1]);
  assert.deepEqual(cart.map(x => x.productId), ['juice', 'juice']);
});
