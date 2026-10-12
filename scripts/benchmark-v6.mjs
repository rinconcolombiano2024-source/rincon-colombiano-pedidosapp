#!/usr/bin/env node
/** Local synthetic PGlite benchmark. No network, credentials, real orders or providers. */
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync,writeFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {bootstrap,setupOrders,R,sql} from '../tests/support/v5-fixtures.mjs';
const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
if(!args.includes('--baseline'))throw new Error('Use --baseline /absolute/path/to/original-V5-checkout');
const baseline=resolve(get('--baseline')),root=resolve('.');
const out={runtime:process.version,baseline:'fae1e3cc62eb792eb2ef67ea4de44ecf38d9f35f',environment:'local PGlite single process; no Supabase/network/hardware',outbox:[],orders:[],accounting:[]};
const registry={create:()=>({meta:{provisional:false},buildOutbound:()=>{throw new Error('network forbidden in benchmark');}})};
for(const historicalRows of [1000,10000,50000]){
 const db=new PGlite({extensions:{pgcrypto}});await bootstrap(db);await db.exec(sql('MIGRACION-V5-20261010-03-DELIVERY-OUTBOX.sql'));await db.exec(sql('MIGRACION-V5-20261010-06-OUTBOX-BOUNDS.sql'));
 await db.query(`insert into rc_delivery_outbox_v5(id,restaurant_user_id,entry)
 select md5(i::text),$1::uuid,jsonb_build_object('id',md5(i::text),'restaurantId',$1::text,'state','sent','provider','wolt','orderId',i::text,'action','accept','createdAt',1,'nextAttemptAt',1,'deadlineAt',9999999999999,'attempts',1,'payload',jsonb_build_object('note',repeat('x',128)))
 from generate_series(1,$2::int) i`,[R,historicalRows]);
 for(const [version,dir] of [['V5-latest',baseline],['V6',root]]){
  
  const {DeliveryOutbox}=await import(pathToFileURL(join(dir,'delivery-bridge/src/outbox.mjs')));
  const {PostgresOutboxStore}=await import(pathToFileURL(join(dir,'delivery-bridge/src/postgres-outbox-store.mjs')));
  let queryCount=0,returnedRows=0,returnedBytes=0;
  const query=async(...a)=>{queryCount++;const r=await db.query(...a);returnedRows+=r.rows.length;returnedBytes+=Buffer.byteLength(JSON.stringify(r.rows));return r;};
  const box=new DeliveryOutbox({restaurantId:R,store:new PostgresOutboxStore({query,restaurantId:R}),registry,fetchImpl:async()=>{throw new Error('network forbidden');}});
  for(let i=0;i<2;i++)await box.tick();queryCount=returnedRows=returnedBytes=0;
  global.gc?.();const before=process.memoryUsage(),cpu=process.cpuUsage(),times=[];let maxHeap=before.heapUsed;const start=performance.now();
  for(let i=0;i<20;i++){const t=performance.now();await box.tick();times.push(performance.now()-t);maxHeap=Math.max(maxHeap,process.memoryUsage().heapUsed);}
  const used=process.cpuUsage(cpu);times.sort((a,b)=>a-b);
  out.outbox.push({version,historicalRows,cycles:20,queryCount,returnedRows,returnedBytes,wallMs:performance.now()-start,cpuMs:(used.user+used.system)/1000,p50Ms:times[10],p95Ms:times[18],maxObservedHeapGrowthBytes:maxHeap-before.heapUsed,rssBeforeBytes:before.rss,rssAfterBytes:process.memoryUsage().rss});
 }
 await db.close();
}
// Actual old vs incremental RPC, not a JS approximation.
for(const menuSize of [100,1000]){
 const db=new PGlite({extensions:{pgcrypto}});await bootstrap(db);await setupOrders(db);for(const f of ['MIGRACION-V5-20261010-04-VAT-CATEGORIES.sql','MIGRACION-V5-20261010-05-ORDER-MENU-INTEGRITY.sql'])await db.exec(sql(f));
 const menu={Main:Array.from({length:menuSize},(_,i)=>({id:'dish-'+i,name:'Dish '+i,price:1.23,available:true,vatRate:'8'}))};
 await db.query('update app_settings set menu=$1 where user_id=$2',[JSON.stringify(menu),R]);
 const payload=JSON.stringify({paymentMethod:'Pago al recoger',items:Array.from({length:60},(_,i)=>({product_id:'dish-'+(menuSize-1-i),quantity:1}))});
 for(const version of ['V5-latest','V6']){
  if(version==='V6')for(const f of ['MIGRACION-V5-20261010-10-EXPLICIT-VAT-UNKNOWN.sql'])await db.exec(sql(f));
  const times=[],cpu=process.cpuUsage(),start=performance.now();
  for(let i=0;i<25;i++){const t=performance.now();const r=await db.query("select * from rc_ordera_create_customer_order_edge(gen_random_uuid(),$1,'benchmark-private-token','T','Test','Recoger en el punto',$2,null,0)",[R,payload]);if(r.rows.length!==1)throw new Error('Missing order');times.push(performance.now()-t);}
  const used=process.cpuUsage(cpu);times.sort((a,b)=>a-b);out.orders.push({version,menuSize,items:60,requests:25,wallMs:performance.now()-start,cpuMs:(used.user+used.system)/1000,p50Ms:times[12],p95Ms:times[23]});
 }
 await db.close();
}
// Read-only daily close workload with a fixed timezone and exact monetary inputs.
const accountingInput={orders:Array.from({length:2000},(_,i)=>({id:'order-'+i,status:'delivered',total:'12.30',currency:'PLN',payment_method:'cash',created_at:'2026-10-10T12:00:00Z',items:[{productId:'dish',quantity:1,lineTotal:'12.30',vatRate:'23'}]}))};
for(const [version,dir] of [['V5-latest',baseline],['V6',root]]){
 const {buildDailyClose}=await import(pathToFileURL(join(dir,'accounting/src/daily-close.mjs')));
 buildDailyClose(accountingInput,{date:'2026-10-10'});global.gc?.();const start=performance.now(),cpu=process.cpuUsage(),times=[];
 for(let i=0;i<20;i++){const t=performance.now();const r=buildDailyClose(accountingInput,{date:'2026-10-10'});if(!r.valid||r.grossGrosz!==2460000||r.quantitiesByProduct.dish!==2000)throw new Error('Incorrect close');times.push(performance.now()-t);}
 const used=process.cpuUsage(cpu);times.sort((a,b)=>a-b);out.accounting.push({version,orders:2000,closes:20,wallMs:performance.now()-start,cpuMs:(used.user+used.system)/1000,p50Ms:times[10],p95Ms:times[18]});
}
writeFileSync(args.includes('--output')?get('--output'):'V6-PERFORMANCE-RESULTS.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
