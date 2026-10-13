"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { readFileSync } = require("node:fs");

function runMenuHarness(file) {
  const source = readFileSync(file, "utf8");
  const extract = (start, end) => {
    const a = source.indexOf(start);
    const b = source.indexOf(end, a);
    assert.ok(a >= 0 && b > a, `Missing menu source region in ${file}: ${start}`);
    return source.slice(a, b);
  };
  const enqueued = [];
  const translatedByFallback = [];
  const dish = {
    id: "dish-1", name: "Bandeja paisa", description: "Plato colombiano",
    price: 60, available: true,
    translations: {
      es: { name: "Bandeja paisa", description: "Plato colombiano" },
      pl: { name: "Bandeja paisa po polsku", description: "Kolumbijskie danie" },
      en: { name: "Paisa platter", description: "Colombian dish" },
    },
  };
  const menuGrid = { innerHTML: "" };
  const context = vm.createContext({
    customerLanguage: "pl",
    customerMenu: { Platos: [dish] },
    customerActiveCategory: "Platos",
    customerSearchQuery: "",
    customerElements: { menuGrid },
    customerNormalizeProductDescription: value => String(value || "").trim().replace(/\s+/g, " ").slice(0, 260),
    customerMenuTextDisplay: value => {
      translatedByFallback.push(value);
      return `fallback:${value}`;
    },
    customerNormalizeSearchText: value => String(value || "").toLowerCase(),
    customerQueueMenuTextTranslation: value => { enqueued.push(value); },
    customerEscapeHtml: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;"),
    customerFormatMoney: amount => `${amount} PLN`,
    customerProductAvailable: value => value.available !== false,
    customerMenuSearchEntries: () => [],
    customerT: key => key,
  });
  vm.runInContext([
    extract("function customerHasSavedDishTranslation(", "function customerScheduleDescriptionRender("),
    extract("function customerQueueDescriptionTranslation(", "function customerRenderGreeting("),
    extract("function customerRenderMenu() {", "function customerCartItemCount() {"),
  ].join("\n"), context, { filename: file });
  return { context, dish, menuGrid, enqueued, translatedByFallback };
}

for (const file of ["cliente.js", "www/cliente.js"]) {
  test(`${file}: merchant's saved Polish and English translations override old cached text`, () => {
    const h = runMenuHarness(file);
    h.context.customerRenderMenu();
    assert.match(h.menuGrid.innerHTML, /Bandeja paisa po polsku/);
    assert.match(h.menuGrid.innerHTML, /Kolumbijskie danie/);
    assert.doesNotMatch(h.menuGrid.innerHTML, /fallback:Bandeja paisa|fallback:Plato colombiano/);
    assert.deepEqual(h.enqueued, ["Platos"], "Only category without saved translation is queued");
    h.context.customerLanguage = "en";
    h.context.customerRenderMenu();
    assert.match(h.menuGrid.innerHTML, /Paisa platter/);
    assert.match(h.menuGrid.innerHTML, /Colombian dish/);
    assert.doesNotMatch(h.menuGrid.innerHTML, /Kolumbijskie danie/);
  });

  test(`${file}: a live menu update replaces a saved translation without reopening the page`, () => {
    const h = runMenuHarness(file);
    h.context.customerRenderMenu();
    h.dish.translations.pl.description = "Nowy opis z kuchni";
    h.context.customerRenderMenu();
    assert.match(h.menuGrid.innerHTML, /Nowy opis z kuchni/);
    assert.doesNotMatch(h.menuGrid.innerHTML, /Kolumbijskie danie/);
  });

  test(`${file}: missing translated fields fall back and queue translation, never show objects`, () => {
    const h = runMenuHarness(file);
    h.dish.translations.pl = { name: "Polska nazwa", description: { unexpected: true } };
    h.context.customerRenderMenu();
    assert.match(h.menuGrid.innerHTML, /Polska nazwa/);
    assert.match(h.menuGrid.innerHTML, /fallback:Plato colombiano/);
    assert.doesNotMatch(h.menuGrid.innerHTML, /\[object Object\]/);
    assert.deepEqual(h.enqueued, ["Platos", "Plato colombiano"]);
    h.context.customerLanguage = "es";
    h.context.customerRenderMenu();
    assert.match(h.menuGrid.innerHTML, /Plato colombiano/);
  });
}
