// Pure inventory accounting engine. Integer millibase units and minor currency units.
// Server must authorize restaurant/warehouse and commit movements atomically.
import { inventoryQuantity } from "./ledger.mjs";
const id=(v)=>{if(typeof v!=="string"||!v.trim()||v.trim().length>128)throw new TypeError("INVALID_ID");return v.trim()};
const integer=(v)=>{if(!Number.isSafeInteger(v)||v<0)throw new RangeError("INVALID_INTEGER");return v};
export function purchaseConversion({packs,factorBaseMilli}) {
 const n=integer(packs),f=integer(factorBaseMilli);
 if(!f||!n||!Number.isSafeInteger(n*f))throw new RangeError("INVALID_CONVERSION");
 return n*f;
}
export function fifoIssue({restaurantId,warehouseId,ingredientId,lots,quantity}) {
 const scope=[restaurantId,warehouseId,ingredientId].map(id);
 const demand=inventoryQuantity(quantity);
 if(!demand)throw new RangeError("ZERO_ISSUE");
 if(!Array.isArray(lots))throw new TypeError("INVALID_LOTS");
 const seen=new Set(),ordered=lots.map(l=>{
  if(!l||[l.restaurantId,l.warehouseId,l.ingredientId].map(id).some((v,i)=>v!==scope[i]))throw new Error("SCOPE_MISMATCH");
  const lotId=id(l.lotId);
  if(seen.has(lotId))throw new Error("DUPLICATE_LOT");
  seen.add(lotId);
  if(typeof l.receivedAt!=="string"||!/^\d{4}-\d\d-\d\dT/.test(l.receivedAt)||!Number.isFinite(Date.parse(l.receivedAt)))throw new TypeError("INVALID_RECEIPT_DATE");
  const availableMilli=integer(l.availableMilli),totalCostMinor=integer(l.totalCostMinor),originalMilli=integer(l.originalMilli);
  if(!originalMilli||availableMilli>originalMilli)throw new RangeError("INVALID_LOT");
  return {lotId,receivedAt:l.receivedAt,availableMilli,totalCostMinor,originalMilli};
 }).sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)||a.lotId.localeCompare(b.lotId));
 if(ordered.reduce((s,l)=>s+l.availableMilli,0)<demand)throw new RangeError("INSUFFICIENT_STOCK");
 let remaining=demand,totalCostMinor=0;
 const allocations=[];
 for(const l of ordered){
  if(!remaining)break;
  const usedMilli=Math.min(remaining,l.availableMilli);
  if(!usedMilli)continue;
  // Cumulative allocation avoids per-issue rounding drift for partial lots.
  const before=l.originalMilli-l.availableMilli;
  const cost=Math.round((before+usedMilli)*l.totalCostMinor/l.originalMilli)-Math.round(before*l.totalCostMinor/l.originalMilli);
  if(!Number.isSafeInteger(cost)||!Number.isSafeInteger(totalCostMinor+cost))throw new RangeError("COST_OVERFLOW");
  totalCostMinor+=cost;remaining-=usedMilli;
  allocations.push(Object.freeze({lotId:l.lotId,usedMilli,costMinor:cost}));
 }
 return Object.freeze({restaurantId:scope[0],warehouseId:scope[1],ingredientId:scope[2],issuedMilli:demand,totalCostMinor,allocations:Object.freeze(allocations)});
}
export function physicalCount({theoreticalMilli,countedMilli,bookValueMinor}) {
 const theoretical=integer(theoreticalMilli),counted=integer(countedMilli),value=integer(bookValueMinor);
 if(theoretical===0&&value!==0)throw new RangeError("INVALID_BOOK_VALUE");
 const differenceMilli=counted-theoretical;
 // Positive means surplus; negative means shrinkage.
 const deviationPercent=theoretical===0?(counted===0?0:null):differenceMilli/theoretical*100;
 const valueDifferenceMinor=theoretical===0?0:Math.round(value*differenceMilli/theoretical);
 if(!Number.isSafeInteger(valueDifferenceMinor))throw new RangeError("VALUE_OVERFLOW");
 return Object.freeze({differenceMilli,deviationPercent,valueDifferenceMinor,requiresApproval:differenceMilli!==0});
}
export function reorderAlert({onHandMilli,averageDailyMilli,leadDays,safetyMilli=0}) {
 const onHand=integer(onHandMilli),daily=integer(averageDailyMilli),safety=integer(safetyMilli);
 if(!Number.isSafeInteger(leadDays)||leadDays<0||leadDays>365)throw new RangeError("INVALID_LEAD_TIME");
 const reorderPointMilli=daily*leadDays+safety;
 if(!Number.isSafeInteger(reorderPointMilli))throw new RangeError("REORDER_OVERFLOW");
 return Object.freeze({reorderPointMilli,reorder:onHand<=reorderPointMilli,suggestedPurchaseMilli:Math.max(0,reorderPointMilli+daily-onHand)});
}
export const WASTE_REASONS=Object.freeze(["desperdicio","rotura","consumo_personal","error_cocina"]);
export function wasteRecord({reason,quantity}) {
 if(!WASTE_REASONS.includes(reason))throw new TypeError("INVALID_WASTE_REASON");
 const milli=inventoryQuantity(quantity);
 if(!milli)throw new RangeError("ZERO_WASTE");
 return Object.freeze({reason,milli});
}
