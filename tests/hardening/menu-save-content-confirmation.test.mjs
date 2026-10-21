import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const description='Receta completa ñ Ż 🌽\nIngredientes y preparación.\n'.repeat(400);
const menu=()=>({Comida:[{id:'tamal',name:'Tamal',description,price:48,available:true,imageUrl:'https://example.com/tamal.jpg',translations:{es:{name:'Tamal',description},pl:{name:'Tamal PL',description:'Polski '+description},en:{name:'Tamal EN',description:'English '+description}}}]});
for(const file of ['app.js','www/app.js']){
 const source=readFileSync(file,'utf8');
 const start=source.indexOf('function validatedMenuRevision('),end=source.indexOf('// One in-flight Supabase menu RPC',start);
 assert.ok(start>=0&&end>start);
 function harness(){
  const calls=[],original=menu();
  const ctx=vm.createContext({menuCatalog:structuredClone(original),EMPTY_MENU_CATALOG:{},normalizeMenuCatalog:structuredClone,
   menuCatalogsMatch:(a,b)=>JSON.stringify(a)===JSON.stringify(b),appUiText:s=>s,STORAGE_KEYS:{menuRevision:'revision'},
   saveMenuCache:()=>calls.push('cache'),markMenuPending:()=>calls.push('pending'),storeCloudRevision:()=>calls.push('revision'),
   storeConfirmedCloudMenu:()=>calls.push('confirmed'),verifyPublicMenuProjection:async()=>calls.push('public')});
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,calls,original};
 }
 for(const [label,mutate] of [
  ['truncated description',m=>{m.Comida[0].description=m.Comida[0].description.slice(0,260)}],
  ['lost translation',m=>{delete m.Comida[0].translations.pl}],
  ['changed price',m=>{m.Comida[0].price=0}],
  ['lost photo',m=>{m.Comida[0].imageUrl=''}],
  ['wrong availability',m=>{m.Comida[0].available=false}],
  ['missing product',m=>{m.Comida=[]}],
 ])test(`${file}: ${label} in server acknowledgement must not replace submitted menu`,async()=>{
  const h=harness(),response=structuredClone(h.original);mutate(response);
  await assert.rejects(()=>h.ctx.confirmSavedCloudMenu({menu:response,menuRevision:2},null,h.original),e=>e.code==='MENU_SAVE_CONTENT_MISMATCH');
  assert.deepEqual(h.ctx.menuCatalog,h.original);
  assert.deepEqual(h.calls,[],'no cache, confirmed revision or public confirmation after content loss');
 });
 test(`${file}: exact full descriptions can be confirmed`,async()=>{
  const h=harness();const result=await h.ctx.confirmSavedCloudMenu({menu:h.original,menuRevision:2},null,h.original);
  assert.equal(result.menu.Comida[0].description,description);
  assert.equal(result.localChangesPending,false);assert.ok(h.calls.includes('public'));
 });
 test(`${file}: later local edits remain pending after exact older acknowledgement`,async()=>{
  const h=harness();h.ctx.menuCatalog.Comida[0].price=55;
  const result=await h.ctx.confirmSavedCloudMenu({menu:h.original,menuRevision:2},null,h.original);
  assert.equal(h.ctx.menuCatalog.Comida[0].price,55);assert.equal(result.localChangesPending,true);
 });
}
