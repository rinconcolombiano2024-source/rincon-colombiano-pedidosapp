const {test,expect}=require('@playwright/test');
const {installSupabaseMock}=require('./support/supabase-mock.cjs');
for(const [lang,sending] of [['es','Enviando pedido...'],['pl','Wysylanie zamowienia...'],['en','Sending order...']]){
 test(`checkout ${lang}: waiting state survives render and restores editable cart after failure`,async({page})=>{
  await installSupabaseMock(page);await page.goto(`/cliente.html?lang=${lang}`);
  await page.evaluate(()=>{
   customerStoreId='fixture-store';customerUser=null;
   customerSelectedRestaurant=()=>({operationalOpen:true});customerValidateOrderData=()=>true;
   customerCart=[{id:'fixture-dish',productId:'fixture-dish',name:'Arepa',qty:1,price:10,note:''}];
   customerElements.nameInput.value='Test';customerElements.orderType.value='Recoger en el punto';
   customerCreateCustomerOrder=()=>new Promise(resolve=>{window.releaseCheckout=()=>resolve(null);});
   customerRenderCart();customerOpenHeaderCart();
  });
  const send=page.locator('#sendCustomerOrderButton');await send.click();
  // Polish UI may apply accents after runtime localization; retain an anchored semantic label assertion.
  const expectedSendingLabel = lang === 'pl' ? /^Wysy(?:l|ł)anie zam(?:o|ó)wienia\.\.\.$/ : sending;
  await expect(send).toBeDisabled();await expect(send).toHaveText(expectedSendingLabel);await expect(send).toHaveAttribute('aria-busy','true');
  await expect(page.locator('#customerCartItems [data-action="plus"]')).toBeDisabled();
  await page.evaluate(()=>customerRenderCart());await expect(send).toBeDisabled();
  await page.evaluate(()=>window.releaseCheckout());await expect(send).toBeEnabled();
  await expect(send).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#customerCartItems [data-action="plus"]')).toBeEnabled();
  await expect(page.locator('#customerCartItems [data-action="qty"]')).toHaveValue('1');
 });
}
