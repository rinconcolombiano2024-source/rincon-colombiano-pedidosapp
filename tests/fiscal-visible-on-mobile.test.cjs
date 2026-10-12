"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
test("in-app fiscal connection button is accessible and prominent on mobile", () => {
  const css = fs.readFileSync("styles.css","utf8");
  assert.equal(css,fs.readFileSync("www/styles.css","utf8"));
  assert.match(css,/#openFiscalPrinterTopButton\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(css,/#openFiscalPrinterTopButton:focus-visible/);
  assert.match(css,/@media\s*\(max-width:\s*760px\)\s*\{\s*#openFiscalPrinterTopButton\s*\{\s*width:\s*100%/);
  const html = fs.readFileSync("restaurante.html","utf8");
  assert.match(html,/<button[^>]*id="openFiscalPrinterTopButton"[^>]*aria-controls="fiscalPrinterDialog"/);
  assert.match(html,/<button[^>]*id="connectFiscalPrinterButton"/);
  assert.match(html,/<dialog[^>]*id="fiscalPrinterDialog"/);
});
