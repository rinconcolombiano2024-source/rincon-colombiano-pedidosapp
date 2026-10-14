const { test, expect } = require("@playwright/test");

test("portal version check is manual and never navigates without a second click",async({page})=>{
  await page.goto("/index.html",{waitUntil:"domcontentloaded"});
  await page.locator("#autoLanguageSelect").selectOption("es");
  const button=page.locator("[data-check-portal-version]");
  const status=page.locator("#portalVersionStatus");
  await expect(button).toBeVisible();
  await expect(status).toBeHidden();
  await expect(page.locator(".apps > a")).toHaveCount(3);
  await page.route("**/rc-ordera-release.json?check=*",route=>route.fulfill({
    status:200, contentType:"application/json",
    body:JSON.stringify({app:"RC ORDERA",release:"2026-10-14-r24"}),
  }));
  await button.click();
  await expect(status).toContainText("actualizada");
  await expect(button).toHaveText("Comprobar versión");
  await page.unroute("**/rc-ordera-release.json?check=*");
  await page.route("**/rc-ordera-release.json?check=*",route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({app:"RC ORDERA",release:"2026-10-15-r24"}),
  }));
  const oldUrl=page.url();
  await button.click();
  await expect(status).toContainText("Hay una versión nueva");
  await expect(button).toHaveText("Abrir versión nueva");
  expect(page.url()).toBe(oldUrl);
});
