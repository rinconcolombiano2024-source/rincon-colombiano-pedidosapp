import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const js = readFileSync("mesero.js", "utf8");
const html = readFileSync("mesero.html", "utf8");
const sql = readFileSync("MIGRACION-FASE1-V71-MESEROS-ESTACIONES.sql", "utf8");
const androidJs = readFileSync("www/mesero.js", "utf8");
const androidHtml = readFileSync("www/mesero.html", "utf8");

test("table and customer fields exist on web and Android", () => {
  for (const markup of [html, androidHtml]) {
    assert.match(markup, /id="waiterTableInput"/);
    assert.match(markup, /id="waiterCustomerInput"/);
  }
  assert.equal(androidJs, js);
});

test("waiter draft saves and restores both fields", () => {
  assert.match(js, /table:\s*waiterElements\.tableInput\.value/);
  assert.match(js, /customer:\s*waiterElements\.customerInput\.value/);
  assert.match(js, /waiterElements\.tableInput\.value\s*=\s*String\(draft\.table\s*\|\|\s*""\)/);
  assert.match(js, /waiterElements\.customerInput\.value\s*=\s*String\(draft\.customer\s*\|\|\s*""\)/);
});

test("order payload preserves both fields and prevents anonymous table-less orders", () => {
  assert.match(js, /p_table_label:\s*waiterElements\.tableInput\.value\.trim\(\)/);
  assert.match(js, /p_customer_name:\s*waiterElements\.customerInput\.value\.trim\(\)/);
  assert.match(js, /!waiterElements\.tableInput\.value\.trim\(\)\s*&&\s*!waiterElements\.customerInput\.value\.trim\(\)/);
  assert.match(js, /rpc\("submit_waiter_order",\s*payload\)/);
});

test("server function writes independent table and customer columns with bounds", () => {
  assert.match(sql, /create or replace function public\.submit_waiter_order\(/i);
  assert.match(sql, /p_table_label text,\s*p_customer_name text/i);
  assert.match(sql, /table_label,\s*customer_name,/i);
  assert.match(sql, /left\(trim\(coalesce\(p_table_label,\s*''\)\),\s*120\)/i);
  assert.match(sql, /left\(trim\(coalesce\(p_customer_name,\s*''\)\),\s*120\)/i);
});
