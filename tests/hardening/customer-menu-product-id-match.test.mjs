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
    // Menu refreshes must not merge separate cart lines or change quantities.
    context.customerCart = [
      { id: 'line-qty-a', productId: 'juice-2', name: 'Juice', qty: 2, price: 102, note: 'Sin azúcar' },
      { id: 'line-qty-b', productId: 'juice-2', name: 'Juice', qty: 3, price: 102, note: 'Sin hielo' }
    ];
    context.customerMenu = { Bebidas: [{ id: 'juice-2', name: 'Jugo natural', price: 103, station: 'bar' }] };
    context.customerSyncCartWithCurrentMenu();
    context.customerSyncCartWithCurrentMenu();
    assert.deepEqual(Array.from(context.customerCart, item => item.id), ['line-qty-a', 'line-qty-b']);
    assert.deepEqual(Array.from(context.customerCart, item => item.qty), [2, 3]);
    assert.deepEqual(Array.from(context.customerCart, item => item.note), ['Sin azúcar', 'Sin hielo']);
    assert.deepEqual(Array.from(context.customerCart, item => item.price), [103, 103]);
    // A product removed from the current catalog must never be silently swapped
    // for a different product merely because the translated display name matches.
    context.customerCart = [{ id: 'line-removed', productId: 'removed-id', name: 'Jugo', qty: 1, price: 12, note: 'Sin hielo' }];
    context.customerMenu = { Bebidas: [{ id: 'replacement-id', name: 'Jugo', price: 250, station: 'bar' }] };
    context.customerSyncCartWithCurrentMenu();
    assert.equal(context.customerCart[0].productId, 'removed-id');
    assert.equal(context.customerCart[0].price, 12);
    assert.equal(context.customerCart[0].note, 'Sin hielo');
    // A catalog refresh with a changed description must not overwrite a customer's
    // editable instructions, even when the menu language and product title change.
    context.customerCart = [{ id: 'line-translation', productId: 'juice-2', name: 'Jugo', qty: 1, price: 12, note: 'Sin azúcar' }];
    context.customerMenu = { Napoje: [{ id: 'juice-2', name: 'Sok naturalny', description: 'Świeży sok', price: 18, station: 'bar' }] };
    context.customerSyncCartWithCurrentMenu();
    assert.equal(context.customerCart[0].name, 'Sok naturalny');
    assert.equal(context.customerCart[0].description, 'Świeży sok');
    assert.equal(context.customerCart[0].note, 'Sin azúcar');
    assert.equal(context.customerCart[0].id, 'line-translation');
    // A second refresh must preserve distinct notes and quantities for identical products.
    context.customerCart = [
      { id: 'line-repeat-a', productId: 'juice-2', name: 'Jugo', price: 12, qty: 2, note: 'Sin hielo', station: 'bar' },
      { id: 'line-repeat-b', productId: 'juice-2', name: 'Jugo', price: 12, qty: 3, note: 'Sin azúcar', station: 'bar' }
    ];
    context.customerMenu = { Napoje: [{ id: 'juice-2', name: 'Sok', price: 18, station: 'bar' }] };
    context.customerSyncCartWithCurrentMenu();
    context.customerSyncCartWithCurrentMenu();
    assert.deepEqual(Array.from(context.customerCart, item => item.id), ['line-repeat-a', 'line-repeat-b']);
    assert.deepEqual(Array.from(context.customerCart, item => item.qty), [2, 3]);
    assert.deepEqual(Array.from(context.customerCart, item => item.note), ['Sin hielo', 'Sin azúcar']);
    // Menu prices may legitimately be zero (promotional/free products); do not
    // accidentally replace a valid zero with a stale or nonzero cart price.
    context.customerCart = [{ id: 'line-free', productId: 'juice-2', name: 'Jugo', qty: 1, price: 18, note: 'Sin hielo' }];
    context.customerMenu = { Bebidas: [{ id: 'juice-2', name: 'Jugo promocional', price: 0, station: 'bar' }] };
    context.customerSyncCartWithCurrentMenu();
    assert.equal(context.customerCart[0].price, 0);
    assert.equal(context.customerCart[0].note, 'Sin hielo');
    // Invalid catalog prices must not silently make existing cart lines free.
    for (const invalidPrice of [undefined, null, '', 'not-a-price', -4, 'Infinity']) {
      context.customerCart = [{ id: 'line-invalid', productId: 'juice-2', name: 'Jugo', price: 18, qty: 1, note: 'Sin hielo' }];
      context.customerMenu = { Bebidas: [{ id: 'juice-2', name: 'Jugo', price: invalidPrice, station: 'bar' }] };
      context.customerSyncCartWithCurrentMenu();
      assert.equal(context.customerCart[0].price, 18, 'invalid catalog price must not become zero');
      assert.equal(context.customerCart[0].note, 'Sin hielo');
    }
    // Valid numeric prices supplied as strings must remain supported; whitespace-only
    // and malformed values must never be interpreted as free promotions.
    for (const [catalogPrice, expected] of [['18.50', 18.5], [' 0 ', 0], ['   ', 18], ['-0.01', 18], ['1e309', 18]]) {
      context.customerCart = [{ id: 'line-price-validation', productId: 'juice-2', name: 'Jugo', price: 18, qty: 1, note: 'Sin azúcar' }];
      context.customerMenu = { Bebidas: [{ id: 'juice-2', name: 'Jugo', price: catalogPrice, station: 'bar' }] };
      context.customerSyncCartWithCurrentMenu();
      assert.equal(context.customerCart[0].price, expected);
      assert.equal(context.customerCart[0].note, 'Sin azúcar');
    }
    // Repeated refreshes must be idempotent, including when a menu temporarily
    // contains an invalid price and later recovers to an authoritative price.
    context.customerCart = [{ id: 'line-recovery', productId: 'juice-2', name: 'Jugo', price: 18, qty: 2, note: 'Sin hielo' }];
    context.customerMenu = { Bebidas: [{ id: 'juice-2', name: 'Jugo', price: 'broken', station: 'bar' }] };
    context.customerSyncCartWithCurrentMenu();
    context.customerSyncCartWithCurrentMenu();
    assert.equal(context.customerCart[0].price, 18);
    assert.equal(context.customerCart[0].qty, 2);
    assert.equal(context.customerCart[0].note, 'Sin hielo');
    context.customerMenu.Bebidas[0].price = 21;
    context.customerSyncCartWithCurrentMenu();
    assert.equal(context.customerCart[0].price, 21);
    assert.equal(context.customerCart[0].id, 'line-recovery');
    assert.equal(context.customerCart[0].note, 'Sin hielo');
    // Product updates must never erase individual custom instructions or line identities.
    context.customerCart = [
      { id: 'line-mixed-a', productId: 'juice-2', name: 'Jugo', price: 12, qty: 1, note: '<img src=x onerror=alert(1)>' },
      { id: 'line-mixed-b', productId: 'juice-2', name: 'Jugo', price: 12, qty: 2, note: 'Sin azúcar' }
    ];
    context.customerMenu = { Bebidas: [{ id: 'juice-2', name: 'Sok', price: 18, station: 'bar' }] };
    context.customerSyncCartWithCurrentMenu();
    assert.deepEqual(Array.from(context.customerCart, item => item.id), ['line-mixed-a', 'line-mixed-b']);
    assert.deepEqual(Array.from(context.customerCart, item => item.note), ['<img src=x onerror=alert(1)>', 'Sin azúcar']);
    assert.deepEqual(Array.from(context.customerCart, item => item.qty), [1, 2]);
    assert.deepEqual(Array.from(context.customerCart, item => item.price), [18, 18]);
    // This test covers data preservation, not HTML escaping at the rendering sink.
    // Restore the original menu fixture for the legacy name-only fallback assertion.
    context.customerMenu = { Bebidas: [{ id: 'juice-2', name: 'Jugo', description: 'Other product', price: 99, station: 'bar' }] };
    // Preserve backwards compatibility for cart items created before product IDs existed.
    const legacy = { name: 'Jugo' };
    assert.equal(context.customerFindCurrentMenuProduct(legacy)?.id, 'juice-2');
  });
}
