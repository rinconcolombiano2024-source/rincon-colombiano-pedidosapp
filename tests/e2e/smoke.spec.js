const { test, expect } = require("@playwright/test");
const { installSupabaseMock } = require("./support/supabase-mock.cjs");

const screens = [
  { name: "principal", path: "/index.html?app=v91.0.4", selector: ".portal" },
  { name: "cliente", path: "/cliente.html?app=v91.0.4&lang=es", selector: ".customer-app-shell" },
  { name: "colaborador", path: "/colaborador.html?app=v91.0.4&lang=es", selector: ".collaborator-app-shell" },
  { name: "mesero", path: "/mesero.html?app=v91.0.4&lang=es", selector: ".waiter-shell" },
  { name: "administracion", path: "/admin.html?app=v91.0.4&lang=es", selector: ".platform-admin-shell" },
];

for (const screen of screens) {
  test(`${screen.name}: inicia sin errores fatales`, async ({ page }) => {
    await installSupabaseMock(page);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto(screen.path, { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator(screen.selector)).toHaveCount(1);
    await page.waitForTimeout(400);

    const duplicateIds = await page.evaluate(() => {
      const counts = new Map();
      document.querySelectorAll("[id]").forEach((element) => {
        counts.set(element.id, (counts.get(element.id) || 0) + 1);
      });
      return [...counts.entries()].filter(([, count]) => count > 1);
    });
    expect(duplicateIds).toEqual([]);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    expect(pageErrors).toEqual([]);
  });
}
