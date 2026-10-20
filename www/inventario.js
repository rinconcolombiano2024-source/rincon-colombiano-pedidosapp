
document.getElementById("stockCalculator").addEventListener("submit",event=>{
 event.preventDefault();const form=event.currentTarget;const data=new FormData(form);
 const quantity=Number(data.get("quantity")),minimum=Number(data.get("minimum")),price=Number(data.get("price"));
 const result=document.getElementById("result");
 if(![quantity,minimum,price].every(Number.isFinite)||quantity<0||minimum<0||price<0){result.textContent="Datos no válidos";return;}
 result.textContent=(quantity<=minimum?"⚠️ Existencias bajas":"✓ Existencias sobre el mínimo")+" · Valor estimado: "+(quantity*price).toFixed(2)+" "+data.get("currency");
});
