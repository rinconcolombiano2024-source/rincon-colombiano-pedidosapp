const {test,expect}=require('@playwright/test');
const {installSupabaseMock}=require('./support/supabase-mock.cjs');

test('two identical products keep edited notes through languages, menu refresh and failed submission',async({page})=>{
  await installSupabaseMock(page);
  await page.goto('/cliente.html?lang=es');
  await page.evaluate(()=>{
    customerStoreId='fixture-store';customerUser=null;
    customerSelectedRestaurant=()=>({operationalOpen:true});
    customerValidateOrderData=()=>true;
    const dish={id:'juice',name:'Jugo',description:'Mango',price:15,station:'bar'};
    customerMenu={Bebidas:[dish]};customerCart=[];
    customerAddItem(dish);customerAddItem(dish);
    customerElements.nameInput.value='Test';
    customerElements.orderType.value='Recoger en el punto';
    customerCreateCustomerOrder=async payload=>{window.capturedOrder=payload;return null;};
    customerOpenHeaderCart();
  });
  const notes=page.locator('#customerCartItems [data-action="note"]');
  await expect(notes).toHaveCount(2);
  await notes.nth(0).fill('Sin azúcar');
  await notes.nth(1).fill('Sin hielo');
  for(const lang of ['pl','en','es']){
    await page.evaluate(lang=>customerSetLanguage(lang),lang);
    await expect(notes.nth(0)).toHaveValue('SIN AZÚCAR');
    await expect(notes.nth(1)).toHaveValue('SIN HIELO');
  }
  await notes.nth(0).fill('Sin azúcar, salsa aparte');
  await page.evaluate(()=>{customerSyncCartWithCurrentMenu();customerRenderCart();});
  await page.locator('#sendCustomerOrderButton').click();
  await expect.poll(()=>page.evaluate(()=>window.capturedOrder?.items?.length)).toBe(2);
  const items=await page.evaluate(()=>window.capturedOrder.items);
  expect(items.map(item=>item.note)).toEqual(['SIN AZÚCAR, SALSA APARTE','SIN HIELO']);
  expect(items.map(item=>item.options_snapshot.note)).toEqual(items.map(item=>item.note));
  expect(items.map(item=>item.unit_price_snapshot)).toEqual([15,15]);
  expect(items.map(item=>item.quantity)).toEqual([1,1]);
  await expect(notes.nth(0)).toHaveValue('SIN AZÚCAR, SALSA APARTE');
  await expect(notes.nth(1)).toHaveValue('SIN HIELO');
});
