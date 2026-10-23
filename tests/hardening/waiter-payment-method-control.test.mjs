import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("waiter collects customer name, table, and selected payment method", () => {
  const html = read("mesero.html");
  const js = read("mesero.js");
  for (const id of ["waiterTable", "waiterCustomer", "waiterPaymentMethod"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  for (const method of ["Pago en caja", "Efectivo", "Transferencia", "Datafono"]) {
    assert.match(html, new RegExp('value="' + method + '"'));
  }
  assert.match(js, /p_payment_method:\s*waiterElements\.paymentMethod\.value/);
});

test("waiter order RPC stores payment method without claiming the order is paid", () => {
  const sql = read("MIGRACION-FASE1-V71-MESEROS-ESTACIONES.sql");
  assert.match(sql, /p_payment_method\s+text/);
  assert.match(sql, /'paymentMethod',\s*coalesce\(nullif\(trim\(p_payment_method\), ''\), 'Pago en caja'\)/);
});

test("restaurant tickets distinguish payment status from payment method", () => {
  const js = read("app.js");
  assert.match(js, /function normalizePaymentStatus\(/);
  assert.match(js, /function normalizePaymentMethod\(/);
  assert.match(js, /function updateTicketPaymentStatus\(/);
  assert.match(js, /data-action="toggle-payment"/);
  assert.match(js, /paymentMethodLabel\(order\.paymentMethod\)/);
  assert.match(js, /paymentStatusLabel\(status\)/);
});
