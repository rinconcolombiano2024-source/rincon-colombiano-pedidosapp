const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
test("integration status uses restaurant session namespace and synced distribution", () => {
  const app = fs.readFileSync("app.js", "utf8");
  const status = fs.readFileSync("centro-integraciones-status.js", "utf8");
  const key = /storageKey:\s*["']([^"']+)["']/;
  assert.equal(app.match(key)?.[1], "rc-ordera-restaurant-auth");
  assert.equal(status.match(key)?.[1], app.match(key)?.[1]);
  assert.equal(fs.readFileSync("www/centro-integraciones-status.js", "utf8"), status);
  assert.match(status, /autoRefreshToken:\s*false/);
  assert.match(status, /detectSessionInUrl:\s*false/);
  new vm.Script(status);
});
