// Pure display-only calculation: does not update orders, menus or inventory.
function valid(value,max,scale) {
 return typeof value==="number" && Number.isFinite(value) && value>=0 && value<=max &&
  Math.abs(value*scale-Math.round(value*scale))<=1e-7;
}
export function calculateStockPreview({quantity,minimum,price}) {
 if(!valid(quantity,1_000_000_000,1000)||!valid(minimum,1_000_000_000,1000)||
    !valid(price,1_000_000_000,100)) throw new RangeError("INVALID_STOCK_PREVIEW");
 const milli=Math.round(quantity*1000);
 const cents=Math.round(price*100);
 const valueMinor=Math.round(milli*cents/1000);
 if(!Number.isSafeInteger(valueMinor)) throw new RangeError("INVALID_STOCK_PREVIEW");
 return Object.freeze({status:quantity===0?"out":quantity<=minimum?"low":"ok",valueMinor});
}
