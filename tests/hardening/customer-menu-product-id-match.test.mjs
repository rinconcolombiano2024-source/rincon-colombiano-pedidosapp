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
    // Identical products with distinct line IDs must retain independent instructions.
    context.customerCart = [
      { id: 'line-b', productId: 'juice-2', name: 'Jugo', price: 12, qty: 1, note: 'Sin azúcar', station: 'bar' },
      { id: 'line-c', productId: 'juice-2', name: 'Jugo', price: 12, qty: 1, note: 'Sin hielo', station: 'bar' },
      { id: 'line-d', productId: 'juice-1', name: 'Jugo', price: 15, qty: 1, note: 'Salsa aparte', station: 'bar' }
    ];
    context.customerSyncCartWithCurrentMenu();
    assert.deepEqual(Array.from(context.customerCart, item => item.id), ['line-b', 'line-c', 'line-d']);
    assert.deepEqual(Array.from(context.customerCart, item => item.note), ['Sin azúcar', 'Sin hielo', 'Salsa aparte']);
    assert.deepEqual(Array.from(context.customerCart, item => item.productId), ['juice-2', 'juice-2', 'juice-1']);
    assert.deepEqual(Array.from(context.customerCart, item => item.price), [99, 99, 15]);
    // A renamed product must still be resolved by its stable ID, never by stale display text.
    context.customerCart = [{ id: 'line-renamed', productId: 'juice-2', name: 'Nombre anterior', price: 12, qty: 1, note: 'Sin cebolla', station: 'bar' }];
    context.customerSyncCartWithCurrentMenu();
    assert.equal(context.customerCart[0].productId, 'juice-2');
    assert.equal(context.customerCart[0].price, 99);
    assert.equal(context.customerCart[0].note, 'Sin cebolla');
    assert.equal(context.customerCart[0].id, 'line-renamed');
    // Switching menu language or category must not erase per-line notes or select by translated name.
    context.customerMenu = { Napoje: [{ id: 'juice-2', name: 'Sok', description: 'Bez cukru', price: 101, station: 'bar' }] };
    context.customerCart = [
      { id: 'line-pl-a', productId: 'juice-2', name: 'Jugo', price: 99, qty: 1, note: 'Sin azúcar', station: 'bar' },
      { id: 'line-pl-b', productId: 'juice-2', name: 'Jugo', price: 99, qty: 1, note: 'Sin hielo', station: 'bar' }
    ];
    context.customerSyncCartWithCurrentMenu();
    assert.deepEqual(Array.from(context.customerCart, item => item.id), ['line-pl-a', 'line-pl-b']);
    assert.deepEqual(Array.from(context.customerCart, item => item.note), ['Sin azúcar', 'Sin hielo']);
    assert.deepEqual(Array.from(context.customerCart, item => item.productId), ['juice-2', 'juice-2']);
    assert.deepEqual(Array.from(context.customerCart, item => item.price), [101, 101]);
    // During temporary offline/cache gaps, retain the cart without deleting any line or note.
    context.customerMenu = {};
    context.customerSyncCartWithCurrentMenu();
    assert.deepEqual(Array.from(context.customerCart, item => item.id), ['line-pl-a', 'line-pl-b']);
    assert.deepEqual(Array.from(context.customerCart, item => item.note), ['Sin azúcar', 'Sin hielo']);
    assert.deepEqual(Array.from(context.customerCart, item => item.price), [101, 101]);
    // Once the menu returns, refresh the catalog data without overwriting instructions.
    context.customerMenu = { Drinks: [{ id: 'juice-2', name: 'Juice', price: 102, station: 'bar' }] };
    context.customerSyncCartWithCurrentMenu();
    assert.deepEqual(Array.from(context.customerCart, item => item.note), ['Sin azúcar', 'Sin hielo']);
    assert.deepEqual(Array.from(context.customerCart, item => item.price), [102, 102]);
    // Restore the original menu fixture for the legacy name-only fallback assertion.
    context.customerMenu = { Bebidas: [{ id: 'juice-2', name: 'Jugo', description: 'Other product', price: 99, station: 'bar' }] };
    // Preserve backwards compatibility for cart items created before product IDs existed.
    const legacy = { name: 'Jugo' };
    assert.equal(context.customerFindCurrentMenuProduct(legacy)?.id, 'juice-2');
  });
}
