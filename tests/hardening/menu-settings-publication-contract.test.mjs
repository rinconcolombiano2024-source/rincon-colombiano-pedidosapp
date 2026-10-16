import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Contract tests for critical save/publication guards. These are NOT a
// substitute for a real Supabase Storage/RPC/browser integration test.
for (const file of ["app.js", "www/app.js"]) {
  const source = readFileSync(resolve(process.cwd(), file), "utf8");

  test(`${file}: menu publication requires public projection confirmation`, () => {
    assert.match(source, /async function confirmSavedCloudMenu\(/);
    assert.match(source, /await verifyPublicMenuProjection\(confirmedMenu, revision\)/);
    assert.match(source, /PUBLIC_MENU_PROJECTION_MISSING/);
    assert.match(source, /PUBLIC_MENU_PROJECTION_MISMATCH/);
    assert.match(source, /PUBLIC_MENU_REVISION_MISMATCH/);
  });

  test(`${file}: menu images materialize before the cloud menu RPC`, () => {
    const start = source.indexOf("async function saveCloudMenuRequest()");
    const end = source.indexOf("async function saveRestaurantPublicProfile()", start);
    assert.ok(start >= 0 && end > start, "menu save implementation exists");
    const fn = source.slice(start, end);
    const upload = fn.indexOf("await materializeMenuImagesForCloud(");
    const rpc = fn.indexOf('rpc("save_current_restaurant_menu"');
    assert.ok(upload >= 0 && rpc > upload, "upload must precede save RPC");
    assert.match(fn, /assertMenuOwnerSession\(\)/);
    assert.match(fn, /mergeConcurrentMenuChanges\(/);
  });

  test(`${file}: restaurant hours use settings RPC and cloud confirmation`, () => {
    const start = source.indexOf("async function saveCloudSettings()");
    const end = source.indexOf("async function readCurrentCloud", start + 1);
    const fn = source.slice(start, end > start ? end : start + 8000);
    assert.match(fn, /save_current_restaurant_settings/);
    assert.match(fn, /p_expected_revision/);
    assert.match(fn, /confirmed\?\.settings/);
    assert.match(source, /openingHours: profile\.opening_hours/);
  });
}

test("distributed restaurant code matches root", () => {
  assert.equal(
    readFileSync(resolve("app.js"), "utf8"),
    readFileSync(resolve("www/app.js"), "utf8"),
  );
});

for (const file of ["app.js", "www/app.js"]) {
  test(`${file}: offline image upload must not publish inline photos`, () => {
    const src = readFileSync(resolve(process.cwd(), file), "utf8");
    const begin = src.indexOf("async function materializeMenuImagesForCloud(");
    const end = src.indexOf("function menuHasInlineRestaurantImages(", begin);
    assert.ok(begin >= 0 && end > begin);
    const fn = src.slice(begin, end);
    assert.match(fn, /pendingImages\.length/);
    assert.match(fn, /!navigator\.onLine/);
    assert.match(fn, /throw new Error\(/);
  });
}
