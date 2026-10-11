const {test,expect}=require('@playwright/test');
const {installSupabaseMock}=require('./support/supabase-mock.cjs');
for(const [lang,title] of [['es','Centro de Integraciones'],['pl','Centrum integracji'],['en','Integration centre']]){
 test(`integration centre ${lang}: accessible language, tabs and disabled sensitive actions`,async({page})=>{
  await installSupabaseMock(page);await page.goto('/centro-integraciones.html?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);await expect(page.locator('h1')).toHaveText(title);
  await page.locator('#tab-fiscal').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#panel-delivery')).toBeVisible();
  await expect(page.locator('#tab-delivery')).toHaveAttribute('aria-selected','true');
  const active=page.locator('#panel-delivery button');for(let i=0;i<await active.count();i++)await expect(active.nth(i)).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}

test('customer: concurrent requests and lost acknowledgement retain server identity in real browser',async({page})=>{
 await installSupabaseMock(page);await page.goto('/cliente.html?lang=es');
 const result=await page.evaluate(async()=>{
  customerStoreId='11111111-1111-4111-8111-111111111111';let n=0;const payloads=[];
  customerClient.functions.invoke=async(_,{body})=>{n++;payloads.push(body);await new Promise(r=>setTimeout(r,5));if(n===1)return {error:new Error('simulated acknowledgement lost')};return {data:{id:body.p_id,public_token:body.p_public_token}};};
  const p={items:[{product_id:'dish',quantity:1}],paymentMethod:'Pago al recoger'};
  await Promise.allSettled(Array.from({length:100},()=>customerCreateCustomerOrder(p,10,'T','Test','Recoger en el punto')));
  const confirmed=await customerCreateCustomerOrder(p,10,'T','Test','Recoger en el punto');
  return {n,sameId:payloads[0].p_id===confirmed.id,sameToken:payloads[0].p_public_token===confirmed.publicToken};
 });
 expect(result).toEqual({n:2,sameId:true,sameToken:true});
});
test('actual enforced CSP blocks dynamic evaluation',async({page})=>{
 const response=await page.goto('/centro-integraciones.html?lang=en');expect(response.headers()['content-security-policy']).not.toContain('unsafe-eval');
 await expect(page.locator('h1')).toHaveText('Integration centre');
 // CDP page.evaluate bypasses CSP; execute the probe as an ordinary document script.
 await page.goto('/tests/e2e/fixtures/csp-probe.html');
 expect(await page.evaluate(()=>window.__cspEvalBlocked)).toBe(true);
 expect(await page.evaluate(()=>window.__unauthorizedInlineRan)).toBe(false);
});

test('diagnostics retain readable spacing across ES/PL/EN and mobile layout',async({page})=>{
 await installSupabaseMock(page,{user:{id:'11111111-1111-4111-8111-111111111111'}});
 await page.route('**/functions/v1/integration-status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({fiscal:{registeredDevices:2,unknownOperations:1},delivery:{pendingReview:3},payment:{}})}));
 await page.goto('/centro-integraciones.html?lang=es');
 for(const [lang,label] of [['es','Dispositivos registrados: 2'],['pl','Zarejestrowane urządzenia: 2'],['en','Registered devices: 2']]){
  await page.locator('#integrationLanguage').selectOption(lang);
  await page.locator('#panel-fiscal button:not([disabled])').first().click();
  await expect(page.locator('#panel-fiscal section p').filter({hasText:label})).toHaveText(label);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 }
});

test('integration centre accessible names follow language changes',async({page})=>{
 await installSupabaseMock(page);await page.goto('/centro-integraciones.html?lang=pl');
 await expect(page.getByRole('tablist',{name:'Kategorie',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Diagnostyka integracji',exact:true})).toBeVisible();
 await page.locator('#integrationLanguage').selectOption('en');
 await expect(page.getByRole('tablist',{name:'Categories',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Integration diagnostics',exact:true})).toBeVisible();
});
