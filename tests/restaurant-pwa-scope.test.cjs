'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
test('installed restaurant PWA cannot capture client or kitchen routes', () => {
  for (const prefix of ['', 'www/']) {
    const manifest = JSON.parse(read(prefix + 'restaurante-manifest.webmanifest'));
    const start = new URL(manifest.start_url, 'https://example.test/' + prefix);
    const scope = new URL(manifest.scope, 'https://example.test/' + prefix);
    assert.equal(scope.pathname, '/' + prefix + 'restaurante.html');
    assert.ok(start.href.startsWith(scope.href), 'restaurant start_url must be within scope');
    for (const route of ['cliente.html', 'mesero.html', 'estaciones.html']) {
      const external = new URL(route, 'https://example.test/' + prefix);
      assert.equal(external.href.startsWith(scope.href), false, route + ' must not be captured by installed restaurant');
    }
    const html = read(prefix + 'restaurante.html');
    assert.match(html, /href="restaurante-manifest\.webmanifest"/);
  }
});
