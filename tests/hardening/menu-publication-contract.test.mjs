import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Guard the existing cloud-publication path without touching production data.
const app = readFileSync('app.js', 'utf8');
const slice = (start, end) => {
  const a = app.indexOf(start);
  const z = app.indexOf(end, a + start.length);
  assert.ok(a >= 0 && z > a, 'menu publication contract section exists');
  return app.slice(a, z);
};

test('menu editor queues a durable local copy before attempting cloud publication', () => {
  const source = slice('function saveMenuCatalog() {', 'function syncResultMessage(');
  assert.match(source, /markMenuPending\(\)/);
  assert.match(source, /saveMenuCache\(\{ immediate: true \}\)/);
  assert.ok(source.indexOf('markMenuPending()') < source.indexOf('saveMenuWhenPossible()'));
});

test('menu cloud publication materializes images before the revision-checked RPC', () => {
  const source = slice('async function saveCloudMenuRequest() {', 'function persistMenuCatalogCache() {');
  assert.match(source, /materializeMenuImagesForCloud\(menuBeforeImageUpload\)/);
  assert.match(source, /assertMenuOwnerSession\(\)/);
  assert.match(source, /save_current_restaurant_menu/);
  assert.match(source, /p_expected_revision:/);
  assert.ok(source.indexOf('materializeMenuImagesForCloud(') < source.indexOf('save_current_restaurant_menu'));
});

test('publication does not claim client synchronization after an unconfirmed save', () => {
  const source = slice('async function publishCurrentRestaurantMenu() {', '// One in-flight save per restaurant');
  assert.match(source, /result\.synced && !hasPendingMenu\(\)/);
  assert.match(source, /No se confirmó la publicación/);
  assert.match(source, /No hay productos para publicar/);
});

test('settings publication retains optimistic concurrency and session isolation', () => {
  const source = slice('async function saveCloudSettings() {', 'async function saveCloudMenu() {');
  assert.match(source, /save_current_restaurant_settings/);
  assert.match(source, /p_expected_revision:/);
  assert.match(source, /SETTINGS_SESSION_CHANGED/);
});

// Regression: Android packaging must not silently omit the public privacy notice.
test('privacy notice is linked and packaged in the Android web runtime', () => {
  const index = readFileSync('index.html', 'utf8');
  const privacy = readFileSync('privacy.html', 'utf8');
  const prepare = readFileSync('scripts/prepare-capacitor.mjs', 'utf8');
  assert.match(index, /href=["']privacy\.html["']/);
  assert.match(index, /href=["']privacy\.html["'][^>]*aria-label=["']Privacidad, datos personales y cookies["']/);
  assert.match(prepare, /["']privacy\.html["']/);
  assert.match(privacy, /Jhon Jarolt Mendez/i);
});

// Detect stale Android assets that would display an older menu or lose per-item notes.
test('Android web bundle matches the menu editor and client ordering sources', () => {
  for (const filename of ['app.js', 'cliente.js', 'restaurante.html', 'cliente.html']) {
    assert.equal(
      readFileSync('www/' + filename, 'utf8'),
      readFileSync(filename, 'utf8'),
      filename + ' must match the Android packaged copy'
    );
  }
});

// The customer must be able to understand and edit per-product instructions in all supported languages.
test('individual product note controls retain Spanish Polish and English labels', () => {
  const source = readFileSync('cliente.js', 'utf8');
  for (const key of ['itemNoteLabel', 'itemNotePlaceholder', 'splitItem']) {
    assert.equal((source.match(new RegExp('\\b' + key + ':', 'g')) || []).length, 3,
      key + ' must have an ES/PL/EN translation');
  }
  assert.match(source, /Observaciones para este producto/);
  assert.match(source, /Uwagi do tego produktu/);
  assert.match(source, /Instructions for this item/);
  assert.equal(readFileSync('www/cliente.js', 'utf8'), source);
});

// A slow image upload must not overwrite a newer restaurant profile edit.
test('settings logo upload rejects late results after edits or account changes', () => {
  const source = slice('async function saveCloudSettings() {', 'async function saveCloudMenu() {');
  assert.match(source, /const originalLogo = businessLogoUrl/);
  assert.match(source, /const originalPendingToken = currentSettingsPendingToken\(\)/);
  assert.match(source, /await uploadRestaurantImageDataUrl\(/);
  assert.match(source, /assertSaveSession\(\)/);
  assert.match(source, /originalPendingToken !== currentSettingsPendingToken\(\)/);
  assert.match(source, /originalLogo !== businessLogoUrl/);
  assert.ok(source.indexOf('originalLogo !== businessLogoUrl') < source.indexOf('businessLogoUrl = uploadedLogo'));
});
