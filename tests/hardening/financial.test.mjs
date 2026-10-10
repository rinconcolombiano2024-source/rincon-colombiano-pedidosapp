import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRate,splitGross,vatSummary} from '../../accounting/src/vat.mjs';
import {buildDailyClose} from '../../accounting/src/daily-close.mjs';
import {buildMonthlyClose} from '../../accounting/src/monthly-close.mjs';
import {reconcileProvider} from '../../accounting/src/reconcile.mjs';
const order={id:'order',status:'delivered',currency:'PLN',total:'10.00',payment_method:'cash',created_at:'2026-10-10T12:00:00Z',items:[{lineTotal:'10.00',vatRate:'NP',productId:'x',quantity:1}]};
test('NP/NP I/NP II/ZW/0 remain separate financial categories, including monthly sums',()=>{
 const categories=['0','ZW','NP','NP I','NP II'];
 const report=vatSummary(categories.map(vatRate=>({vatRate,grossGrosz:100})));
 assert.deepEqual(Object.keys(report.byRate),categories);assert.equal(report.vat,0);assert.equal(report.gross,500);
 for(const rate of categories){assert.equal(normalizeRate(rate.toLowerCase()),rate);assert.equal(splitGross(-101,rate).net,-101);}
 const day=buildDailyClose({orders:[order]},{date:'2026-10-10'});
 assert.equal(day.valid,true);assert.equal(day.vat.byRate.NP.gross,1000);assert.equal(day.vat.byRate.ZW,undefined);
 const month=buildMonthlyClose([day],'2026-10');assert.equal(month.vatByRate.NP.gross,1000);assert.equal(month.vatByRate.ZW.gross,0);
});
test('device letters need an explicit reviewed mapping; unknown classification fails closed',()=>{
 for(const r of ['A','B','C','D','E','F','OO','7','VAT_99'])assert.throws(()=>normalizeRate(r),{code:'UNKNOWN_VAT_RATE'});
 assert.equal(normalizeRate('A',{A:'8'}),'8');assert.equal(normalizeRate('E',{E:'NP'}),'NP');
});
test('VAT aggregation checks inputs and cross-category safe-integer overflow',()=>{
 assert.throws(()=>vatSummary([{vatRate:'NP',grossGrosz:1.5}]),{code:'INVALID_MONEY'});
 assert.throws(()=>vatSummary([{vatRate:'NP',grossGrosz:Number.MAX_SAFE_INTEGER},{vatRate:'ZW',grossGrosz:1}]),{code:'MONEY_OVERFLOW'});
 assert.throws(()=>vatSummary([{vatRate:'NP',grossGrosz:Number.MAX_SAFE_INTEGER},{vatRate:'NP',grossGrosz:1}]),{code:'MONEY_OVERFLOW'});
});
test('currency cannot be guessed during provider reconciliation',()=>{
 const pay={provider_reference:'r',amount:'10.00',currency:'PLN',status:'paid'};
 for(const currency of [undefined,'','EUR','12P']){
  const result=reconcileProvider([pay],[{reference:'r',amount:'10.00',currency}]);
  assert.equal(result.ok,false);assert.deepEqual(result.matched,[]);assert.deepEqual(result.currencyMismatch,['r']);
 }
 assert.equal(reconcileProvider([pay],[{reference:'r',amount:'10.00',currency:'pln'}]).ok,true);
});
test('confirmed simulated fiscal receipt never satisfies real fiscal requirement',()=>{
 for(const extra of [{},{fiscal:false,simulated:true},{fiscal:true,simulated:true}]){
  const c=buildDailyClose({orders:[order],fiscalOps:[{order_id:'order',state:'confirmed',...extra}]},{date:'2026-10-10',fiscalRequired:true});
  assert.equal(c.valid,false);assert.ok(c.issues.some(i=>i.code==='FISCAL_RECEIPT_MISSING'));
 }
 assert.equal(buildDailyClose({orders:[order],fiscalOps:[{order_id:'order',state:'confirmed',fiscal:true,simulated:false}]},{date:'2026-10-10',fiscalRequired:true}).valid,true);
});
test('invalid calendar periods and monthly overflow are rejected',()=>{
 assert.throws(()=>buildDailyClose({},{date:'2026-02-30'}),{code:'INVALID_DATE'});
 for(const m of ['2026-00','2026-13'])assert.throws(()=>buildMonthlyClose([],m),{code:'INVALID_MONTH'});
 const day=buildDailyClose({orders:[order]},{date:'2026-10-10'});
 assert.throws(()=>buildMonthlyClose([{...day,grossGrosz:Number.MAX_SAFE_INTEGER},{...day,date:'2026-10-11'}],'2026-10'),{code:'MONEY_OVERFLOW'});
});

test('missing IDs, refund currency/identity and missing processing time invalidate audit',()=>{
 const p={id:'p',customer_order_id:'order',status:'paid',amount:'10.00',currency:'PLN'};
 const r={id:'r',payment_transaction_id:'p',status:'succeeded',amount:'1.00',processed_at:'2026-10-10T12:00:00Z',vatLines:[{vatRate:'NP',grossGrosz:100}]};
 for(const [refund,code] of [[{...r,currency:'EUR'},'REFUND_CURRENCY_MISMATCH'],[{...r,customer_order_id:'another-order'},'REFUND_ORDER_MISMATCH'],[{...r,processed_at:null},'REFUND_TIMESTAMP_MISSING'],[{...r,amount:'-1.00'},'NEGATIVE_REFUND']]){
  const c=buildDailyClose({payments:[p],refunds:[refund]},{date:'2026-10-10'});assert.equal(c.valid,false);assert.ok(c.issues.some(i=>i.code===code));
 }
 const missing=buildDailyClose({orders:[{...order,id:undefined}]},{date:'2026-10-10'});assert.equal(missing.valid,false);assert.equal(missing.orders,0);
});

test('date formatter reuse reduces allocations and cache stays bounded across timezones',async()=>{
 const module=await import('../../accounting/src/daily-close.mjs?isolated-cache-test');
 const Native=Intl.DateTimeFormat;let created=0;
 Intl.DateTimeFormat=new Proxy(Native,{construct(target,args){created++;return Reflect.construct(target,args);}});
 try{
  for(let i=0;i<2000;i++)assert.equal(module.localDate('2026-10-10T12:00:00Z','Europe/Warsaw'),'2026-10-10');assert.equal(created,1);
  const zones=['Europe/Berlin','Europe/Rome','Europe/Paris','Europe/Madrid','Europe/London','Europe/Lisbon','Europe/Prague','Europe/Vienna','Europe/Oslo'];
  for(const zone of zones)module.localDate('2026-10-10T12:00:00Z',zone);
  module.localDate('2026-10-10T12:00:00Z','Europe/Warsaw');assert.equal(created,11); // oldest of 8 slots evicted
 }finally{Intl.DateTimeFormat=Native;}
});

import {fromCustomerOrderRow} from '../../accounting/src/adapters.mjs';
test('accounting adapter preserves explicit unknown snapshots; legacy default remains marked assumed',()=>{
 const row={...order,order_json:{items:[{product_id:'x',quantity:1,total_snapshot:'10.00',vat_rate_snapshot:null}]}};
 let c=buildDailyClose({orders:[fromCustomerOrderRow(row)]},{date:'2026-10-10',defaultVatRate:'23'});
 assert.equal(c.valid,false);assert.ok(c.issues.some(i=>i.code==='VAT_SNAPSHOT_UNKNOWN'));assert.equal(c.grossGrosz,1000);assert.equal(c.vatAssumedLines,0);assert.equal(c.vat.gross,0);
 delete row.order_json.items[0].vat_rate_snapshot;c=buildDailyClose({orders:[fromCustomerOrderRow(row)]},{date:'2026-10-10',defaultVatRate:'23'});
 assert.equal(c.valid,true);assert.equal(c.vatAssumedLines,1);assert.equal(c.vat.gross,1000);
});
test('explicit unknown delivery VAT cannot use a conflicting audit default',()=>{
 const row={...order,total:'12.00',final_delivery_fee:'2.00',order_json:{delivery_vat_rate_snapshot:null,items:[{product_id:'x',quantity:1,total_snapshot:'10.00',vat_rate_snapshot:'NP'}]}};
 const c=buildDailyClose({orders:[fromCustomerOrderRow(row)]},{date:'2026-10-10',defaultVatRate:'23'});
 assert.equal(c.valid,false);assert.ok(c.issues.some(i=>i.code==='VAT_RATE_MISSING'&&i.detail==='delivery_fee'));assert.equal(c.vat.gross,1000);assert.equal(c.grossGrosz,1200);assert.equal(c.vat.byRate.NP.gross,1000);
});
