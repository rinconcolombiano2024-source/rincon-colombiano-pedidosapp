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

for(const lang of ['es','pl','en']){
 test(`portal install manifest resolves for ${lang}`,async({page})=>{
  await page.goto('/index.html?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  const manifest=page.locator('link[rel="manifest"]');
  await expect(manifest).toHaveAttribute('href',lang==='es'?'portal-manifest.webmanifest':`portal-manifest.${lang}.webmanifest`);
  const response=await page.request.get(await manifest.getAttribute('href'));
  expect(response.ok()).toBeTruthy();const data=await response.json();expect(data.id).toBe('./portal-app');expect(data.start_url).toContain('index.html');
 });
}
