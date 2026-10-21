import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../../mesero.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../../mesero.js', import.meta.url), 'utf8');

test('waiter customer and table fields are present and connected', () => {
  for (const id of ['waiterTableInput', 'waiterCustomerInput']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
    assert.match(js, new RegExp(`querySelector\\(["']#${id}["']\\)`));
  }
});
test('waiter draft saves and restores both fields', () => {
  assert.match(js, /table:\s*waiterElements\.tableInput\.value/);
  assert.match(js, /customer:\s*waiterElements\.customerInput\.value/);
  assert.match(js, /tableInput\.value\s*=\s*String\(draft\.table\s*\|\|\s*""\)/);
  assert.match(js, /customerInput\.value\s*=\s*String\(draft\.customer\s*\|\|\s*""\)/);
});
test('waiter RPC receives table and customer as distinct parameters', () => {
  assert.match(js, /p_table_label:\s*waiterElements\.tableInput\.value\.trim\(\)/);
  assert.match(js, /p_customer_name:\s*waiterElements\.customerInput\.value\.trim\(\)/);
  assert.match(js, /waiterClient\.rpc\("submit_waiter_order",\s*payload\)/);
});
