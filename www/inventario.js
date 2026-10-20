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

const addButton=document.getElementById("showProductForm");
const productForm=document.getElementById("newProductForm");
if(addButton&&productForm){
 addButton.addEventListener("click",()=>{
  productForm.hidden=!productForm.hidden;
  addButton.setAttribute("aria-expanded",String(!productForm.hidden));
  if(!productForm.hidden)productForm.querySelector("input")?.focus();
 });
 productForm.addEventListener("submit",event=>{
  event.preventDefault();
  const values=new FormData(productForm);
  const result=document.getElementById("productResult");
  const factor=Number(values.get("factor")),minimum=Number(values.get("minimum"));
  const validText=["name","supplier","purchaseUnit"].every(key=>{
   const value=values.get(key);return typeof value==="string"&&value.trim().length>0&&value.trim().length<=160;
  });
  if(!validText||!Number.isSafeInteger(factor)||factor<1||!Number.isFinite(minimum)||minimum<0||minimum>1000000000||Math.round(minimum*1000)!==minimum*1000){
   result.textContent="Comprueba los datos y las conversiones antes de continuar.";return;
  }
  result.textContent="✓ Datos válidos. Registro todavía no disponible: no se ha guardado el producto.";
 });
}
