import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

for (const path of ['cliente.js', 'www/cliente.js']) {
  test(`${path}: refresh never replaces a cart product with a different ID sharing its name`, () => {
    const source = readFileSync(path, 'utf8');
    const start = source.indexOf('function customerFindCurrentMenuProduct(cartItem) {');
    const end = source.indexOf('async function customerLoadMenu(', start);
    assert.ok(start >= 0 && end > start);
    const cart = [{ id: 'line-a', productId: 'juice-1', name: 'Jugo', description: 'Original', price: 15, qty: 1, note: 'Sin hielo', station: 'bar' }];
    const context = {
      customerCart: cart,
      customerMenu: { Bebidas: [{ id: 'juice-2', name: 'Jugo', description: 'Other product', price: 99, station: 'bar' }] },
      customerNormalizeProductId: value => String(value || ''),
      customerNormalizeProductStation: value => value || 'bar',
      Number, Object, String
    };
    vm.createContext(context);
    vm.runInContext(source.slice(start, end), context);
    context.customerSyncCartWithCurrentMenu();
    assert.equal(context.customerCart[0].productId, 'juice-1');
    assert.equal(context.customerCart[0].price, 15);
    assert.equal(context.customerCart[0].note, 'Sin hielo');
    assert.equal(context.customerCart[0].id, 'line-a');
    // Preserve backwards compatibility for cart items created before product IDs existed.
    const legacy = { name: 'Jugo' };
    assert.equal(context.customerFindCurrentMenuProduct(legacy)?.id, 'juice-2');
  });
}
