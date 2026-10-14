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
  await page.goto("/restaurante.html?app=v91.0.4-nav3", { waitUntil: "domcontentloaded" });
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
  // A modal is top-layer and must be dismissed before interacting with the
  // restaurant dashboard. This tests a genuine user navigation sequence.
  await page.locator("#waiterTeamDialog").evaluate(dialog => dialog.close());
  await expect(page.locator("#waiterTeamDialog")).not.toBeVisible();

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
  // Returning to the restaurant tab must not sign the operator out or reset
  // the active POS session after opening any of the three external modules.
  await expect.poll(() => page.evaluate(() => Boolean(cloudState?.user?.id))).toBe(true);
  await expect(page.locator("#openFiscalPrinterTopButton")).toBeVisible();
});

test("fiscal button is in the restaurant app; permission does not enable fiscal printing", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "serial", { configurable: true, value: {
      requestPort: async () => ({ getInfo: () => ({ usbVendorId: 1234 }) }),
      getPorts: async () => []
    } });
  });
  await installSupabaseMock(page, { user });
  await page.goto("/restaurante.html?app=v91.0.4-nav3", { waitUntil: "domcontentloaded" });
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

for (const language of ['es','pl','en']) test(`portal keeps staff inside restaurant and language selector clear of cards (${language})`,async({page,context})=>{
 await installSupabaseMock(page);
 await page.goto(`/index.html?lang=${language}`,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#autoLanguageSelect')).toHaveCount(1);
 await page.locator('#autoLanguageSelect').selectOption(language);
 await expect(page.locator('html')).toHaveAttribute('lang',language);
 await expect(page.locator('.apps > a')).toHaveCount(3);
 await expect(page.locator('.apps a[href="mesero.html"]')).toHaveCount(0);
 const selector=await page.locator('.app-language-floating').boundingBox();
 const brand=await page.locator('.brand').boundingBox();
 expect(selector.y+selector.height).toBeLessThanOrEqual(brand.y);
 await page.locator('.apps a[href="restaurante.html"]').scrollIntoViewIfNeeded();
 // The selector scrolls away; it cannot cover a role card as in the reported screenshot.
 const position=await page.locator('.app-language-floating').evaluate(el=>getComputedStyle(el).position);
 expect(position).toBe('static');
 await page.locator('.apps a[href="restaurante.html"]').click();
 await expect(page.locator('#restaurantStaffAccessLink')).toBeVisible();
 const opened=context.waitForEvent('page');
 await page.locator('#restaurantStaffAccessLink').click();
 const station=await opened;
 await expect.poll(()=>station.url()).toContain('/mesero.html');
 expect(page.url()).toContain('/restaurante.html');
 await station.close();
});
