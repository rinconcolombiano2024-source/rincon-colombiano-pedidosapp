// Non-destructive contract tests for waiter table/customer fields.
// Run: node --test tests/waiter-table-customer-contract.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../mesero.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../mesero.js'), 'utf8');

test('waiter table and customer inputs exist', () => {
  assert.match(html, /id="waiterTableInput"/);
  assert.match(html, /id="waiterCustomerInput"/);
});
test('draft stores and restores table and customer independently', () => {
  assert.match(js, /table:\\s*waiterElements\\.tableInput\\.value/);
  assert.match(js, /customer:\\s*waiterElements\\.customerInput\\.value/);
  assert.match(js, /waiterElements\\.tableInput\\.value\\s*=\\s*String\\(draft\\.table/);
  assert.match(js, /waiterElements\\.customerInput\\.value\\s*=\\s*String\\(draft\\.customer/);
});
test('order RPC payload contains both fields without swapping them', () => {
  const start = js.indexOf('function waiterOrderPayload()');
  assert.notEqual(start, -1);
  const payload = js.slice(start, js.indexOf('function waiterReadQueue()', start));
  assert.match(payload, /p_table_label:\\s*waiterElements\\.tableInput\\.value\\.trim\\(\\)/);
  assert.match(payload, /p_customer_name:\\s*waiterElements\\.customerInput\\.value\\.trim\\(\\)/);
});
test('submission uses the existing waiter order RPC', () => {
  assert.match(js, /waiterClient\\.rpc\\("submit_waiter_order", payload\\)/);
});
