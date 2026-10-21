import { ingredientPayload, createInventoryCatalog } from "./inventory/persistence.mjs";
import { calculateStockPreview } from "./inventory/preview.mjs";
document.getElementById("stockCalculator").addEventListener("submit",event=>{
 event.preventDefault();
 const data=new FormData(event.currentTarget);
 const quantity=Number(data.get("quantity")),minimum=Number(data.get("minimum")),price=Number(data.get("price"));
 const result=document.getElementById("result");
 try {
  const preview=calculateStockPreview({quantity,minimum,price});
  const label=preview.status==="out"?"⛔ Sin existencias":preview.status==="low"?"⚠️ Existencias bajas":"✓ Existencias sobre el mínimo";
  result.textContent=label+" · Valor estimado: "+(preview.valueMinor/100).toFixed(2)+" "+data.get("currency");
 } catch {
  result.textContent="Datos no válidos: comprueba cantidades (3 decimales) y precios (2 decimales).";
 }
});


// Reuse the restaurant login; identity is validated again by RLS and the RPC.
const form=document.getElementById("newProductForm");
const add=document.getElementById("showProductForm"),reload=document.getElementById("reloadCatalog");
const status=document.getElementById("catalogStatus"),result=document.getElementById("productResult");
let catalog,owner=null,editing=null,rows=[],warehouses=[];
const setBusy=value=>{for(const el of form.elements)el.disabled=value;add.disabled=value||!owner;reload.disabled=value||!owner;};
const reset=()=>{editing=null;form.reset();form.hidden=true;add.setAttribute("aria-expanded","false");result.textContent="";};
function message(error){
 const s=String(error?.message||error);
 if(s.includes("VERSION_CONFLICT"))return "Otra sesión modificó este insumo. Actualiza el catálogo y revisa los datos antes de guardar.";
 if(s.includes("SESSION_CHANGED")||s.includes("ACCESS_DENIED")||s.includes("SIGN_IN_REQUIRED"))return "La sesión cambió o no tiene permiso. Inicia sesión como propietario del restaurante.";
 if(s.includes("BASE_UNIT_IMMUTABLE"))return "La unidad base no se puede cambiar. Crea otro insumo para una unidad diferente.";
 return "No se pudo confirmar la operación. Conserva los datos y vuelve a intentarlo; no se mostrará un guardado sin confirmación.";
}
function render(){
 const body=document.getElementById("catalogRows");body.replaceChildren();
 document.getElementById("countProducts").textContent=owner?String(rows.length):"—";
 for(const item of rows){
  const tr=document.createElement("tr");
  const location=warehouses.find(w=>w.id===item.default_warehouse_id)?.name||"—";
  const values=[item.name,item.supplier,item.category,location,`${item.purchase_unit_label} / ${item.purchase_factor_milli/1000} ${item.base_unit}`,`${item.min_stock_milli/1000} ${item.base_unit}`];
  const labels=["Insumo","Proveedor","Categoría","Almacén preferido","Compra / conversión","Mínimo"];
  values.forEach((value,i)=>{const td=document.createElement("td");td.dataset.label=labels[i];td.textContent=value;tr.append(td);});
  const td=document.createElement("td"),button=document.createElement("button");button.type="button";button.textContent="Editar";
  button.addEventListener("click",()=>{
   if(reload.disabled)return;
   editing={id:item.id,version:item.version};
   const fields={name:item.name,supplier:item.supplier,category:item.category,warehouse:location,unit:item.base_unit==='unit'?'un':item.base_unit,purchaseUnit:item.purchase_unit_label,factor:item.purchase_factor_milli/1000,minimum:item.min_stock_milli/1000};
   for(const [key,value] of Object.entries(fields)){
    const input=form.elements.namedItem(key);
    if(input.tagName==='SELECT'&&![...input.options].some(o=>o.value===String(value))){const o=document.createElement('option');o.value=String(value);o.textContent=String(value);input.append(o);}
    input.value=value;
   }
   form.hidden=false;add.setAttribute("aria-expanded","true");result.textContent="Editando insumo guardado";form.elements.name.focus();
  });td.append(button);tr.append(td);body.append(tr);
 }
 if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.textContent="No hay insumos registrados en esta cuenta.";tr.append(td);body.append(tr);}
}
async function load(){try{const data=await catalog.list();rows=data.items;warehouses=data.warehouses;render();status.textContent="Catálogo conectado al restaurante. Los productos guardados se conservan al recargar.";}catch(error){if(String(error.message).includes('SESSION_CHANGED'))return;status.textContent=message(error);}}
add.addEventListener("click",()=>{reset();form.hidden=false;add.setAttribute("aria-expanded","true");form.elements.name.focus();});
document.getElementById("cancelProductEdit").addEventListener("click",reset);
reload.addEventListener("click",()=>load());
form.addEventListener("submit",async event=>{
 event.preventDefault();const captured=owner;let data;
 try{data=ingredientPayload(Object.fromEntries(new FormData(form)));}catch{result.textContent="Comprueba los campos, los límites y las cantidades con un máximo de 3 decimales.";return;}
 editing ||= {id:crypto.randomUUID(),version:0};const current={...editing};setBusy(true);
 try{const saved=await catalog.save(current.id,current.version,data);if(owner!==captured)return;editing={id:saved.id,version:saved.version};result.textContent="Producto guardado y confirmado en el restaurante.";await load();}
 catch(error){if(owner===captured)result.textContent=message(error);}finally{if(owner===captured)setBusy(false);}
});
async function start(){
 try{
  const config=window.RC_ORDERA_SUPABASE;
  const client=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:"rc-ordera-restaurant-auth"}});
  catalog=createInventoryCatalog(client);
  const change=id=>{if(owner===id)return;owner=id;catalog.setOwner(id);reset();rows=[];warehouses=[];render();setBusy(false);status.textContent=id?"Cargando catálogo…":"Inicia sesión en Restaurante para acceder a su catálogo.";if(id)void load();};
  client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>change(session?.user?.id||null),0);});
  const {data,error}=await client.auth.getUser();if(error||!data.user){status.textContent="Inicia sesión en Restaurante para acceder a su catálogo.";return;}change(data.user.id);
 }catch(error){status.textContent=message(error);}
}
void start();
