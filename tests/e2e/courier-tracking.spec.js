const {test,expect}=require('@playwright/test');
const {installSupabaseMock}=require('./support/supabase-mock.cjs');

for(const [lang,waiting,map] of [
  ['es','Esperando la ubicación del colaborador.','Abrir ubicación en el mapa'],
  ['pl','Oczekiwanie na lokalizację kuriera.','Otwórz lokalizację na mapie'],
  ['en','Waiting for the courier’s location.','Open location in map'],
]) {
  test(`courier ${lang}: missing GPS stays honest and valid GPS is usable at 320px`,async({page})=>{
    await page.setViewportSize({width:320,height:720});
    await installSupabaseMock(page);
    await page.goto(`/cliente.html?lang=${lang}`);
    await page.evaluate(()=>{
      customerSetView("orders", {instant:true});
      customerRenderCourierTracking({assignment_id:'fixture',courier_lat:null,courier_lng:null});
    });
    const card=page.locator('#customerCourierTracking');
    await expect(card).toBeVisible();
    await expect(card).toContainText(waiting);
    await expect(card.locator('a')).toHaveCount(0);
    await expect(card.locator('.customer-courier-tracking-meta')).toHaveText('');
    await page.evaluate(()=>customerRenderCourierTracking({assignment_id:'fixture',
      courier_name:'Aleksander Méndez',courier_lat:52.23,courier_lng:21.01,
      courier_location_updated_at:new Date().toISOString(),estimated_delivery_at:new Date().toISOString()}));
    const link=card.getByRole('link',{name:map,exact:true});
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href',/query=52\.23%2C21\.01$/);
    await expect(card).not.toContainText(waiting);
    const bounds=await link.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  });
}
