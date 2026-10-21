const {test,expect}=require('@playwright/test');
const {installSupabaseMock}=require('./support/supabase-mock.cjs');
const owner='11111111-1111-4111-8111-111111111111';
test('inventory denies signed-out writes and preserves the local calculator',async({page})=>{
 await installSupabaseMock(page);await page.goto('/inventario.html');
 await expect(page.locator('#catalogStatus')).toContainText('Inicia sesión');await expect(page.locator('#showProductForm')).toBeDisabled();
 await page.locator('#stockCalculator [name=product]').fill('Arroz');await page.locator('#stockCalculator button').click();await expect(page.locator('#result')).toContainText('Sin existencias');
});
test('inventory creates, reloads and edits a persisted catalog response without claiming stock',async({page})=>{
 // Browser transport fixture; real SQL authorization and persistence are separately tested in PGlite.
 await page.route('**/vendor/supabase-2.57.4.js',route=>route.fulfill({contentType:'text/javascript',body:`
 const owner='${owner}';let rows=JSON.parse(sessionStorage.getItem('inventory-fixture')||'[]');
 window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:owner}}}),onAuthStateChange:()=>({})},
 from:table=>{const query=new Proxy({},{get:(_,key)=>key==='then'?resolve=>Promise.resolve(resolve({data:table==='rc_inventory_ingredients'?rows:[{id:'warehouse',name:'Bodega Central'}]})):()=>query});return query;},
 rpc:async(name,args)=>{if(name==='user_has_active_role')return {data:true};const item={...args.p_data,id:args.p_id,restaurant_id:owner,version:args.p_expected_version+1,default_warehouse_id:'warehouse'};rows=rows.filter(r=>r.id!==item.id).concat(item);sessionStorage.setItem('inventory-fixture',JSON.stringify(rows));return {data:item};}})};
 `}));
 await page.goto('/inventario.html');await page.locator('#showProductForm').click();
 const form=page.locator('#newProductForm');
 for(const [key,value] of Object.entries({name:'Arroz',supplier:'Makro',purchaseUnit:'Saco 25 kg',factor:'25000',minimum:'0.009'}))await form.locator(`[name=${key}]`).fill(value);
 await form.locator('[name=warehouse]').selectOption({label:'Bodega Central'});
 await form.locator('button[type=submit]').click();await expect(page.locator('#productResult')).toContainText('guardado y confirmado');
 await page.reload();await expect(page.locator('#catalogRows')).toContainText('Arroz');await expect(page.locator('#countProducts')).toHaveText('1');await expect(page.locator('#countAvailable')).toHaveText('—');
 await page.getByRole('button',{name:'Editar',exact:true}).click();await form.locator('[name=name]').fill('Arroz integral');await form.locator('button[type=submit]').click();
 await expect(page.locator('#catalogRows')).toContainText('Arroz integral');await page.reload();await expect(page.locator('#catalogRows')).toContainText('Arroz integral');await expect(page.locator('#countProducts')).toHaveText('1');
});
