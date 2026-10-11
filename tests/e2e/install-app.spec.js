const {test,expect}=require('@playwright/test');
const {installSupabaseMock}=require('./support/supabase-mock.cjs');
for(const path of ['index.html','cliente.html','colaborador.html']){
 test(`visible download and accessible help: ${path}`,async({page})=>{
  await installSupabaseMock(page);await page.goto('/'+path);
  const button=page.locator('[data-install-app]');await expect(button).toBeVisible();
  await button.click();const dialog=page.locator('.rc-install-dialog');await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Android');await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
