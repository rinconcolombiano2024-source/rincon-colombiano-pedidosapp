const {test,expect}=require('@playwright/test');
const {installSupabaseMock}=require('./support/supabase-mock.cjs');
for(const [lang,productLabel,restaurantLabel] of [['es','IVA del producto','IVA por defecto del restaurante'],['pl','Stawka VAT produktu','Domyślna stawka VAT restauracji'],['en','Product VAT rate','Restaurant default VAT rate']]){
 test(`menu VAT ${lang}: distinct categories, unknown review, persistence and server settings`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await installSupabaseMock(page);
  await page.addInitScript(lang=>localStorage.setItem('rincon_colombiano_app_language',lang),lang);
  const response=await page.goto('/restaurante.html');expect(response.headers()['content-security-policy']).not.toMatch(/unsafe-inline|unsafe-eval/);
  await page.evaluate(()=>openMenuEditor());
  await expect(page.locator('#productVatSelect').locator('..')).toContainText(productLabel);
  await expect(page.locator('#restaurantDefaultVatSelect').locator('..')).toContainText(restaurantLabel);
  const saved=await page.evaluate(async()=>{
   menuCatalog={Platos:[]};activeCategory='Platos';renderMenuEditor();
   for(const rate of ['23','8','5','0','ZW','NP','NP I','NP II','']){
    clearProductForm();elements.productCategorySelect.value='Platos';elements.productNameInput.value='Category '+(rate||'inherit');elements.productPriceInput.value='12.34';elements.productVatSelect.value=rate;await saveProduct();
   }
   return menuCatalog.Platos.map(p=>({name:p.name,vat:p.vatRate??null,has:Object.hasOwn(p,'vatRate')}));
  });
  expect(saved.map(p=>p.vat)).toEqual(['23','8','5','0','ZW','NP','NP I','NP II',null]);expect(saved[8].has).toBe(false);
  await page.reload();const reloaded=await page.evaluate(()=>Object.values(readMenuCatalog()).flat().map(p=>p.vatRate??null));expect(reloaded).toEqual(saved.map(p=>p.vat));
  const unknown=await page.evaluate(async()=>{
   menuCatalog=normalizeMenuCatalog({Platos:[{id:'unknown',name:'Needs review',price:10,vatRate:'A'},{id:'null',name:'Null category',price:10,vatRate:null}]});activeCategory='Platos';openMenuEditor();editProduct(0);
   let alerts=0;window.alert=()=>alerts++;await saveProduct();
   const r={selected:elements.productVatSelect.value,vat:menuCatalog.Platos[0].vatRate,alerts,nullPreserved:Object.hasOwn(menuCatalog.Platos[1],'vatRate')&&menuCatalog.Platos[1].vatRate===null};
   defaultVatRate='23';applySettingsPayload({defaultVatRate:null});r.cleared=defaultVatRate;
   r.normalized=['A','B','C','D','E','NP','NP I','NP II','ZW'].map(normalizeVatRate);return r;
  });
  expect(unknown).toEqual({selected:'__unverified__',vat:'A',alerts:1,nullPreserved:true,cleared:'',normalized:['','','','','','NP','NP I','NP II','ZW']});
  expect(errors).toEqual([]);
 });
}
