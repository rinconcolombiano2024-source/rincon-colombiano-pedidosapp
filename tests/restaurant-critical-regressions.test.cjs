'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('restaurant and packaged Android web files retain independent module links', () => {
  for (const name of ['restaurante.html', 'www/restaurante.html']) {
    const html = read(name);
    for (const id of ['restaurantKitchenLink', 'openClientPageButton']) {
      const tag = html.match(new RegExp('<a\\b[^>]*\\bid="' + id + '"[^>]*>', 'i'));
      assert.ok(tag, name + ': missing ' + id);
      assert.match(tag[0], /target="_blank"/i, name + ': must not replace restaurant window');
      assert.match(tag[0], /rel="[^"]*noopener[^"]*"/i, name + ': isolate child browsing context');
    }
  }
});

test('fiscal printer connection is discoverable inside restaurant, not an external web page', () => {
  for (const name of ['restaurante.html', 'www/restaurante.html']) {
    const html = read(name);
    assert.match(html, /id="connectFiscalPrinterButton"/);
    assert.match(html, /id="openFiscalPrinterTopButton"/);
    assert.match(html, /<dialog\b[^>]*id="fiscalPrinterDialog"/);
    assert.match(html, /<script[^>]+src="restaurant-fiscal-ui\.js[^"]*"/);
  }
});

test('fiscal preflight cannot be confused with successful fiscal printing', () => {
  for (const name of ['restaurant-fiscal-ui.js', 'www/restaurant-fiscal-ui.js']) {
    const source = read(name);
    assert.match(source, /NOT a fiscal connection/);
    assert.match(source, /NO supone conexión fiscal/);
    assert.doesNotMatch(source, /\.write\s*\(/, name + ': direct fiscal writes require certified device integration');
  }
});

test('CPU conflict protections must remain active in restaurant and packaged app', () => {
  for (const name of ['app.js', 'www/app.js']) {
    const source = read(name);
    assert.match(source, /function needsAutomaticCloudSync\(/);
    assert.match(source, /!isOrderRevisionSyncBlocked\(order\)/);
    assert.match(source, /isOrderRevisionConflictError\(error\)/);
    assert.match(source, /const CENTRAL_REALTIME_ENABLED = false;/);
  }
});
