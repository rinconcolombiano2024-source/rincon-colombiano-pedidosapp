import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../restaurant-fiscal-ui.js", import.meta.url), "utf8");

test("native customer and station links use deployed HTTPS origin", () => {
  assert.match(source, /const deployedOrigin = "https:\/\/rincon-colombiano-pedidosapp\.vercel\.app\/";/);
  assert.match(source, /window\.Capacitor\?\.isNativePlatform\?\.\(\) \? deployedOrigin : window\.location\.href/);
  assert.match(source, /new URL\(raw, base\)/);
});

test("module launcher retains strict destination allowlist and browser fallback", () => {
  assert.match(source, /\["\/cliente\.html", "\/mesero\.html"\]\.includes\(url\.pathname\)/);
  assert.match(source, /url\.protocol !== "https:"/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /browser\.open\(\{ url \}\)/);
  assert.match(source, /if \(opening\) return/);
});
