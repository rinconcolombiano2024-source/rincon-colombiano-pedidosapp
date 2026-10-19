"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("privacy notice is shipped identically in web and Android assets", () => {
  assert.equal(read("privacy.html"), read("www/privacy.html"));
});

test("privacy notice identifies the individual platform owner and contact", () => {
  const html = read("privacy.html");
  assert.match(html, /Jhon Jarolt Mendez/);
  assert.match(html, /mailto:jarol\.mendez@gmail\.com/);
  assert.match(html, /persona física residente en Polonia/);
  assert.doesNotMatch(html, /<strong>Responsable[^<]*<\/strong>\s*Mendez Ospina/i);
});

test("privacy notice does not falsely certify compliance or cookie consent", () => {
  const html = read("privacy.html");
  assert.match(html, /No se declara aquí que exista un sistema de consentimiento/);
  assert.match(html, /No se afirma una certificación RGPD o PCI DSS/);
  assert.match(html, /Información pendiente antes del lanzamiento/);
});
