import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const file of ["app.js", "www/app.js"]) {
  const source = readFileSync(file, "utf8");
  const begin = source.indexOf("async function materializeMenuImagesForCloud(");
  const end = source.indexOf("function menuHasInlineRestaurantImages(", begin);
  assert.ok(begin >= 0 && end > begin, file);
  const implementation = source.slice(begin, end);
  function harness({ online, signedIn, uploaded }) {
    let uploads = 0;
    const context = {
      navigator: { onLine: online },
      cloudState: { client: signedIn ? {} : null, user: signedIn ? { id: "owner" } : null },
      normalizeMenuCatalog: (menu) => structuredClone(menu),
      isInlineRestaurantImage: (url) => String(url).startsWith("data:"),
      uploadRestaurantImageDataUrl: async () => { uploads++; return uploaded; },
      stableProductId: () => "stable-id",
      appUiText: (message) => message,
    };
    vm.createContext(context);
    vm.runInContext(implementation, context);
    return { run: (menu) => context.materializeMenuImagesForCloud(menu), count: () => uploads };
  }
  const menu = { Comidas: [{ id: "a", name: "Arepa", description: "", imageUrl: "data:image/png;base64,AA==" }] };
  test(`${file}: offline photos reject without uploading`, async () => {
    const h = harness({ online: false, signedIn: true, uploaded: "https://example.invalid/photo.png" });
    await assert.rejects(h.run(menu), /conexión a internet/);
    assert.equal(h.count(), 0);
  });
  test(`${file}: missing session rejects pending photo`, async () => {
    const h = harness({ online: true, signedIn: false, uploaded: "https://example.invalid/photo.png" });
    await assert.rejects(h.run(menu), /conexión a internet/);
    assert.equal(h.count(), 0);
  });
  test(`${file}: online photo is materialized and other fields survive`, async () => {
    const h = harness({ online: true, signedIn: true, uploaded: "https://example.invalid/photo.png" });
    const result = await h.run(menu);
    assert.equal(h.count(), 1);
    assert.equal(result.Comidas[0].imageUrl, "https://example.invalid/photo.png");
    assert.equal(result.Comidas[0].name, "Arepa");
    assert.equal(menu.Comidas[0].imageUrl, "data:image/png;base64,AA==");
  });
  test(`${file}: offline menu with no pending photos remains usable`, async () => {
    const h = harness({ online: false, signedIn: false, uploaded: "" });
    const result = await h.run({ Comidas: [{ name: "Arepa", imageUrl: "https://example.invalid/existing.png" }] });
    assert.equal(result.Comidas[0].name, "Arepa");
    assert.equal(h.count(), 0);
  });
}

for (const file of ["app.js", "www/app.js"]) {
  test(`${file}: failed photo upload does not mutate the editable menu`, async () => {
    const source = readFileSync(file, "utf8");
    const begin = source.indexOf("async function materializeMenuImagesForCloud(");
    const end = source.indexOf("function menuHasInlineRestaurantImages(", begin);
    assert.ok(begin >= 0 && end > begin);
    const context = {
      navigator: { onLine: true },
      cloudState: { client: {}, user: { id: "owner" } },
      normalizeMenuCatalog: (menu) => structuredClone(menu),
      isInlineRestaurantImage: (url) => String(url).startsWith("data:"),
      uploadRestaurantImageDataUrl: async () => { throw new Error("STORAGE_UPLOAD_FAILED"); },
      stableProductId: () => "stable-id",
      appUiText: (message) => message,
    };
    vm.createContext(context);
    vm.runInContext(source.slice(begin, end), context);
    const original = { Comidas: [{ id: "a", name: "Arepa", price: 20, imageUrl: "data:image/png;base64,AA==" }] };
    const snapshot = structuredClone(original);
    await assert.rejects(context.materializeMenuImagesForCloud(original), /STORAGE_UPLOAD_FAILED/);
    assert.deepEqual(original, snapshot, "failed cloud upload must not mutate menu, photo, or price");
  });
}
