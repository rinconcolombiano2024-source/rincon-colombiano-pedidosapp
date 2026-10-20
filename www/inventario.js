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
