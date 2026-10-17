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
  context.customerAddItem(dish);
  assert.equal(cart.length, 2, 'two additions before writing notes must remain independent');
  cart[0].note = 'Sin azúcar';
  cart[1].note = 'Sin hielo';
  assert.equal(cart.length, 2, 'same product must not be merged');
  assert.notEqual(cart[0].id, cart[1].id);
  assert.deepEqual(cart.map(x => x.note), ['Sin azúcar', 'Sin hielo']);
  assert.deepEqual(cart.map(x => x.price), [15, 15]);
  assert.deepEqual(cart.map(x => x.qty), [1, 1]);
  assert.deepEqual(cart.map(x => x.productId), ['juice', 'juice']);
});

test('menu refresh preserves distinct notes and line IDs while updating menu fields', () => {
  const source = readFileSync('cliente.js', 'utf8');
  const start = source.indexOf('function customerFindCurrentMenuProduct(cartItem) {');
  const end = source.indexOf('async function customerLoadMenu(', start);
  assert.ok(start >= 0 && end > start, 'menu synchronization functions exist');
  const cart = [
    { id: 'line-a', productId: 'juice', name: 'Jugo', description: 'Antes', price: 15, qty: 1, note: 'Sin azúcar', station: 'bar' },
    { id: 'line-b', productId: 'juice', name: 'Jugo', description: 'Antes', price: 15, qty: 1, note: 'Sin hielo', station: 'bar' }
  ];
  const context = {
    customerCart: cart,
    customerMenu: { Bebidas: [{ id: 'juice', name: 'Juice', description: 'Fresh', price: 16, station: 'bar' }] },
    customerNormalizeProductId: value => String(value || ''),
    customerNormalizeProductStation: value => value || 'bar',
    Number, Object, String
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  context.customerSyncCartWithCurrentMenu();
  assert.deepEqual(Array.from(context.customerCart, item => item.id), ['line-a', 'line-b']);
  assert.deepEqual(Array.from(context.customerCart, item => item.note), ['Sin azúcar', 'Sin hielo']);
  assert.deepEqual(Array.from(context.customerCart, item => item.qty), [1, 1]);
  assert.deepEqual(Array.from(context.customerCart, item => item.price), [16, 16]);
  assert.deepEqual(Array.from(context.customerCart, item => item.name), ['Juice', 'Juice']);
});

test('menu refresh never merges same-name products with distinct notes or stations', () => {
  const source = readFileSync('cliente.js', 'utf8');
  const start = source.indexOf('function customerFindCurrentMenuProduct(cartItem) {');
  const end = source.indexOf('async function customerLoadMenu(', start);
  assert.ok(start >= 0 && end > start, 'menu synchronization functions exist');
  const cart = [
    { id: 'line-1', productId: 'juice', name: 'Jugo', price: 15, qty: 1, note: 'Sin azúcar', station: 'bar' },
    { id: 'line-2', productId: 'juice', name: 'Jugo', price: 15, qty: 1, note: 'Sin hielo', station: 'bar' },
    { id: 'line-3', productId: 'arepa', name: 'Arepa', price: 20, qty: 1, note: 'Sin cebolla', station: 'kitchen' }
  ];
  const context = {
    customerCart: cart,
    customerMenu: {
      Bebidas: [{ id: 'juice', name: 'Juice', price: 16, station: 'bar' }],
      Comidas: [{ id: 'arepa', name: 'Arepa', price: 22, station: 'kitchen' }]
    },
    customerNormalizeProductId: value => String(value || ''),
    customerNormalizeProductStation: value => value || 'bar',
    Number, Object, String
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  context.customerSyncCartWithCurrentMenu();
  assert.deepEqual(Array.from(context.customerCart, item => [item.id, item.productId, item.note, item.station]), [
    ['line-1', 'juice', 'Sin azúcar', 'bar'],
    ['line-2', 'juice', 'Sin hielo', 'bar'],
    ['line-3', 'arepa', 'Sin cebolla', 'kitchen']
  ]);
  assert.deepEqual(Array.from(context.customerCart, item => item.price), [16, 16, 22]);
  assert.deepEqual(Array.from(context.customerCart, item => item.qty), [1, 1, 1]);
});
