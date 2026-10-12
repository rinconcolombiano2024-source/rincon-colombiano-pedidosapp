const { test, expect } = require("@playwright/test");
const { installSupabaseMock } = require("./support/supabase-mock.cjs");

const user = { id: "00000000-0000-4000-8000-000000000012",
  email: "restaurant@example.test", user_metadata: {}, app_metadata: {} };

async function chooseLanguage(page, language) {
  // The auth-screen language select is hidden after sign-in. Dispatch its
  // genuine change handler rather than waiting for an invisible control.
  await page.locator("#autoLanguageSelect").evaluate((select, value) => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, language);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

test("restaurant QR and stations use a separate tab without navigating away from the POS", async ({ page, context }) => {
  await installSupabaseMock(page, { user });
  await page.goto("/restaurante.html?app=v91.0.4-nav1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof cloudState !== "undefined" && !!cloudState.user);

  await page.evaluate(() => {
    updateQrPreview();
    document.querySelector("#qrDialog").showModal();
  });
  const qrHref=await page.locator("#openClientPageButton").getAttribute("href");
  expect(qrHref).toContain("/cliente.html");
  const first=context.waitForEvent("page");
  await page.locator("#openClientPageButton").click();
  const customerPage=await first;
  await expect.poll(() => customerPage.url()).toContain("/cliente.html");
  expect(page.url()).toContain("/restaurante.html");
  await customerPage.close();
  await page.locator("#qrDialog").evaluate(el => el.close());

  await page.locator("#waiterTeamButton").click();
  await expect(page.locator("#waiterTeamDialog")).toBeVisible();
  const second=context.waitForEvent("page");
  await page.locator("#openWaiterLinkButton").click();
  const stationsPage=await second;
  await expect.poll(() => stationsPage.url()).toContain("/mesero.html");
  expect(page.url()).toContain("/restaurante.html");
  await stationsPage.close();

  // Direct Cocina navigation is a second entry point and must never take over POS.
  const kitchenLink = page.locator("#restaurantKitchenLink");
  await expect(kitchenLink).toHaveAttribute("target", "_blank");
  await expect(kitchenLink).toHaveAttribute("rel", /noopener/);
  const kitchenPopup = context.waitForEvent("page");
  await kitchenLink.click();
  const kitchenPage = await kitchenPopup;
  await expect.poll(() => kitchenPage.url()).toMatch(/\/mesero\.html.*station=kitchen/);
  expect(page.url()).toContain("/restaurante.html");
  await kitchenPage.close();
});

test("fiscal button is in the restaurant app; permission does not enable fiscal printing", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "serial", { configurable: true, value: {
      requestPort: async () => ({ getInfo: () => ({ usbVendorId: 1234 }) }),
      getPorts: async () => []
    } });
  });
  await installSupabaseMock(page, { user });
  await page.goto("/restaurante.html?app=v91.0.4-nav1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof cloudState !== "undefined" && !!cloudState.user);
  // Browser/project defaults may choose English. Select a deterministic locale
  // before making assertions and exercise ES → PL → EN explicitly.
  await chooseLanguage(page, "es");
  await page.locator("#openFiscalPrinterTopButton").click();
  await expect(page.locator("#fiscalPrinterDialog")).toBeVisible();
  await expect(page.locator("#fiscalRequestPortButton")).toHaveText("Autorizar puerto USB/serie");
  await page.locator("#fiscalRequestPortButton").click();
  await expect(page.locator("#fiscalDeviceStatus")).toContainText("NO está verificada");
  await expect(page.locator("#fiscalPrinterSummary")).toHaveText("Sin conexión fiscal verificada");
  await chooseLanguage(page, "pl");
  await expect(page.locator("#fiscalRequestPortButton")).toHaveText("Zezwól na port USB/szeregowy");
  await chooseLanguage(page, "en");
  await expect(page.locator("#fiscalRequestPortButton")).toHaveText("Authorize USB/serial port");
});
