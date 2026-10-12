'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['app.js', 'www/app.js']) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  test(file + ': schedule never starts per-minute RPC polling', () => {
    const start = source.indexOf('function updateRestaurantStatusSync()');
    const end = source.indexOf('async function setRestaurantOperationalMode(', start);
    assert.ok(start >= 0 && end > start);
    const implementation = source.slice(start, end);
    assert.match(implementation, /stopRestaurantStatusSync\(\)/);
    assert.doesNotMatch(implementation, /setInterval|setTimeout|\.rpc\(/);
  });
  test(file + ': schedule is configured once through server RPC', () => {
    assert.match(source, /async function persistRestaurantOperationalModeInCloud\(nextMode\)/);
    assert.match(source, /rpc\("set_current_restaurant_operational_mode"/);
    assert.match(source, /async function syncRestaurantOperationalStatus\(options = \{\}\)/);
    assert.match(source, /rpc\("sync_current_restaurant_operational_status"\)/);
  });
  test(file + ': local opening hours are validated as HH:MM', () => {
    assert.match(source, /function normalizeClockTime\(value, fallback\)/);
    assert.match(source, /function normalizeOpeningHours\(value = \{\}\)/);
    assert.match(source, /function readRestaurantOpeningHours\(\)/);
  });
}
