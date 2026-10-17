import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('app.js', 'utf8');
const section = (start, end) => {
  const a = app.indexOf(start);
  const z = app.indexOf(end, a + start.length);
  assert.ok(a !== -1 && z > a, 'existing alarm section is present');
  return app.slice(a, z);
};

test('restaurant alarm remains enabled and cannot be disabled by legacy controls', () => {
  const source = section('function disableClientAlarm() {', 'function toggleClientAlarm() {');
  assert.match(source, /clientAlarmEnabled = true/);
  assert.match(source, /STORAGE_KEYS\.clientAlarmEnabled,\s*"1"/);
  assert.match(source, /syncClientAlarm\(\)/);
});

test('pending orders trigger repeated audible notifications and stop when cleared', () => {
  const source = section('function syncClientAlarm() {', 'function stopClientAlarm() {');
  assert.match(source, /pendingClientOrdersCount\(\) === 0/);
  assert.match(source, /stopClientAlarm\(\)/);
  assert.match(source, /ringClientAlarm\(\)/);
  assert.match(source, /setInterval\(ringClientAlarm,\s*2400\)/);
  assert.match(source, /if \(clientAlarmTimer\) return/);
});

test('sound generation respects suspended browser audio contexts', () => {
  const source = section('function ringClientAlarm() {', 'function syncClientAlarm() {');
  assert.match(source, /context\.state === "suspended"/);
  assert.match(source, /createOscillator\(\)/);
  assert.match(source, /oscillator\.stop\(/);
});
