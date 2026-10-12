'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const filename of ['app.js', 'www/app.js']) {
  test(filename + ': no central realtime storm', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
    assert.match(source, /const CENTRAL_REALTIME_ENABLED = false;/);
    assert.match(source, /function startCentralRealtime\(\)\s*\{\s*if \(!CENTRAL_REALTIME_ENABLED\)/);
  });
  test(filename + ': customer realtime reconnect is bounded', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
    assert.match(source, /CLIENT_ORDERS_REALTIME_RECONNECT_MAX_MS = 60_000;/);
    assert.match(source, /function scheduleClientOrdersRealtimeReconnect\(\)/);
    assert.match(source, /clientOrdersRealtimeReconnectTimer\s*\|\|/);
    assert.match(source, /Math\.min\(\s*retryDelay \* 2,\s*CLIENT_ORDERS_REALTIME_RECONNECT_MAX_MS/);
  });
  test(filename + ': fallback polling is visibility and connection gated', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
    const start = source.indexOf('function startClientOrdersPolling(');
    const end = source.indexOf('function stopClientOrdersPolling(', start);
    assert.ok(start >= 0 && end > start);
    const body = source.slice(start, end);
    assert.match(body, /clientOrdersRealtimeStatus === "SUBSCRIBED"/);
    assert.match(body, /document\.visibilityState !== "visible"/);
    assert.match(body, /!navigator\.onLine/);
    assert.match(body, /clientOrdersPollGeneration/);
    assert.match(source, /CLIENT_ORDERS_POLL_MIN_MS = 120_000;/);
  });
}
