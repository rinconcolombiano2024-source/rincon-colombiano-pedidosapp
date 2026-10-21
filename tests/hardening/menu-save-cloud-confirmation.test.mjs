import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sources = ["app.js", "www/app.js"].map(path => ({
  path, source: readFileSync(new URL("../../" + path, import.meta.url), "utf8")
}));

for (const {path,source} of sources) {
  test(path + ": menu save is revision-aware and verifies cloud before acknowledging success", () => {
    const request = source.slice(source.indexOf("async function saveCloudMenuRequest()"),source.indexOf("async function saveRestaurantPublicProfile()"));
    assert.match(request, /save_current_restaurant_menu/);
    assert.match(request, /p_expected_revision:/);
    assert.match(request, /isMenuRevisionConflict/);
    assert.match(request, /mergeConcurrentMenuChanges/);
    assert.match(request, /confirmSavedCloudMenu/);
    assert.match(request, /assertMenuOwnerSession/);
    const save = source.slice(source.indexOf("async function saveMenuWhenPossibleNow("),source.indexOf("async function publishCurrentRestaurantMenu("));
    assert.match(save, /withCloudTimeout/);
    assert.match(save, /currentMenuPendingToken/);
    assert.match(save, /clearMenuPending\(menuPendingToken\)/);
    assert.match(save, /markMenuPending\(\)/);
    assert.match(save, /Menú pendiente de sincronización/);
  });

  test(path + ": explicit publish never reports success while menu remains pending", () => {
    const publish = source.slice(source.indexOf("async function publishCurrentRestaurantMenu("),source.indexOf("// One in-flight save per restaurant"));
    assert.match(publish, /markMenuPending\(\)/);
    assert.match(publish, /saveMenuCache\(\{ immediate: true \}\)/);
    assert.match(publish, /result\.synced && !hasPendingMenu\(\)/);
    assert.match(publish, /Los cambios siguen en este dispositivo/);
    assert.match(publish, /No se pudo verificar el menú/);
  });
}
test("root and deployed www menu save logic are byte-identical", () => {
  assert.equal(sources[0].source, sources[1].source);
});
