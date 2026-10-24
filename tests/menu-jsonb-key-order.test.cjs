'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const longDescription = 'Sancocho de bagre, receta completa ñ ż 🌽\n'.repeat(550);
const product = {
  id: 'dish-1',
  name: 'Sancocho',
  description: longDescription,
  price: 55,
  imageUrl: 'https://example.invalid/foto.jpg',
  available: true,
  station: 'kitchen',
  translations: {
    es: { name: 'Sancocho', description: longDescription },
    pl: { name: 'Zupa', description: 'Polski ' + longDescription },
    en: { name: 'Soup', description: 'English ' + longDescription }
  }
};
const reorderKeys = input => Array.isArray(input)
  ? input.map(reorderKeys)
  : input && typeof input === 'object'
    ? Object.fromEntries(Object.keys(input).reverse().map(key => [key, reorderKeys(input[key])]))
    : input;

function loadComparators(file) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const start = source.indexOf('function menuProductCount(');
  const end = source.indexOf('function readConfirmedCloudMenu(', start);
  const productStart = source.indexOf('function menuProductEntryMatches(');
  const productEnd = source.indexOf('function mergeConcurrentMenuChanges(', productStart);
  assert.ok(start >= 0 && end > start && productStart >= 0 && productEnd > productStart);
  const context = vm.createContext({
    menuCatalog: {},
    normalizeMenuCatalog: value => value
  });
  vm.runInContext(source.slice(start, end) + '\n' + source.slice(productStart, productEnd), context, { filename: file });
  return context;
}

for (const file of ['app.js', 'www/app.js']) {
  test(file + ': identical jsonb menu survives property and category key reordering', () => {
    const ctx = loadComparators(file);
    const original = { 'Platos principales': [product], 'Bebidas': [{ id: 'water', name: 'Agua', price: 5 }] };
    const reloaded = reorderKeys(original);
    assert.equal(ctx.menuCatalogsMatch(original, reloaded), true,
      'jsonb key order is not a menu change or a failed cloud confirmation');
  });
  test(file + ': identical product from jsonb cannot create a false three-way edit conflict', () => {
    const ctx = loadComparators(file);
    assert.equal(ctx.menuProductEntryMatches(
      { category: 'Platos principales', product },
      { category: 'Platos principales', product: reorderKeys(product) }
    ), true);
  });
  test(file + ': actual price, full text, photo and availability differences remain visible', () => {
    const ctx = loadComparators(file);
    const original = { Comida: [product] };
    for (const update of [
      dish => { dish.price = 56; },
      dish => { dish.description = dish.description.slice(0, 260); },
      dish => { dish.translations.pl.description = ''; },
      dish => { dish.imageUrl = ''; },
      dish => { dish.available = false; }
    ]) {
      const changed = structuredClone(original);
      update(changed.Comida[0]);
      assert.equal(ctx.menuCatalogsMatch(original, changed), false);
    }
    assert.equal(original.Comida[0].description.length > 10000, true);
  });
  test(file + ': order of products in a category is significant', () => {
    const ctx = loadComparators(file);
    const first = { Comida: [product, { id: 'dish-2', name: 'Tamal', price: 48 }] };
    const reversed = { Comida: [...first.Comida].reverse() };
    assert.equal(ctx.menuCatalogsMatch(first, reversed), false);
  });
}
