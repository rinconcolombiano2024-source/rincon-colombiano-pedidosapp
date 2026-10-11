const {test,expect}=require('@playwright/test');
const {installSupabaseMock}=require('./support/supabase-mock.cjs');

for(const lang of ['es','pl','en']) {
  test(`customer critical actions stay visible and tappable at 320px in ${lang}`,async({page})=>{
    await page.setViewportSize({width:320,height:720});
    await installSupabaseMock(page);
    await page.goto('/cliente.html?lang='+lang);
    await expect(page.locator('html')).toHaveAttribute('lang',lang);
    const buttons=['#customerHeaderCartButton','[data-install-app]'];
    for(const selector of buttons){
      const element=page.locator(selector);
      await expect(element).toBeVisible();
      const size=await element.boundingBox();
      expect(size?.width,`${selector} width`).toBeGreaterThanOrEqual(40);
      expect(size?.height,`${selector} height`).toBeGreaterThanOrEqual(40);
      expect(size?.x,`${selector} left`).toBeGreaterThanOrEqual(-2);
      expect(size.x+size.width,`${selector} right`).toBeLessThanOrEqual(322);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),
      `horizontal overflow on customer ${lang}`).toBeLessThanOrEqual(2);
    await page.locator('[data-install-app]').click();
    await expect(page.locator('.rc-install-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.rc-install-dialog')).not.toBeVisible();
  });
}
