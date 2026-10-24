import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
import {ingredientPayload,createInventoryCatalog} from '../../inventory/persistence.mjs';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const input={name:'Arroz',supplier:'Makro',category:'Secos',warehouse:'Bodega Central',unit:'g',purchaseUnit:'Saco 25kg',factor:'25000',minimum:'0.009'};
const payload=ingredientPayload(input);
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function public.user_has_active_role(text) returns boolean language sql as $$select current_setting('test.owner',true)='yes'$$;`);
await db.exec(readFileSync('MIGRACION-V91-75-INVENTORY-PRIVATE-SCHEMA.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20261021053126_inventory_owner_catalog.sql','utf8'));
test.after(()=>db.close());
const as=async(uid,role='yes')=>db.exec(`set role authenticated;select set_config('test.uid','${uid}',false);select set_config('test.owner','${role}',false);`);
const save=(owner,version,data=payload)=>db.query('select public.rc_inventory_save_ingredient($1,$2,$3,$4) as result',[owner,id,version,data]);
test('owner catalog persists, replays without duplicates, rejects stale updates and keeps warehouse atomic',async()=>{
 await as(a);let row=(await save(a,0)).rows[0].result;assert.equal(row.version,1);assert.equal(row.min_stock_milli,9);
 assert.equal((await save(a,0)).rows[0].result.version,1);
 assert.equal((await save(a,1,{...payload,name:'Arroz integral'})).rows[0].result.version,2);
 await assert.rejects(save(a,1,{...payload,warehouse:'No debe persistir'}),/VERSION_CONFLICT/);
 assert.equal((await db.query('select count(*)::int as n from rc_inventory_warehouses')).rows[0].n,1);
 await assert.rejects(save(a,2,{...payload,base_unit:'ml'}),/BASE_UNIT_IMMUTABLE/);
 await assert.rejects(db.query("update rc_inventory_ingredients set base_unit='ml' where id=$1",[id]),/permission denied/);
});
test('real PostgreSQL RLS hides other tenants and rejects session races, anonymous and non-owner writes',async()=>{
 await as(b);assert.equal((await db.query('select * from rc_inventory_ingredients')).rows.length,0);
 await assert.rejects(save(a,2),/ACCESS_DENIED/);
 await assert.rejects(db.query('insert into rc_inventory_warehouses(restaurant_id,name) values($1,$2)',[a,'Injected']),/row-level security/);
 await as(a,'no');assert.equal((await db.query('select * from rc_inventory_ingredients')).rows.length,0);await assert.rejects(save(a,2),/ACCESS_DENIED/);
 await db.exec('set role anon');await assert.rejects(save(a,2),/permission denied/);await assert.rejects(db.query('select * from rc_inventory_ingredients'),/permission denied/);
});
test('catalog input handles decimal precision without floating point rejection',()=>{
 assert.equal(payload.min_stock_milli,9);for(const minimum of ['','-1','Infinity','0.0001','1e4'])assert.throws(()=>ingredientPayload({...input,minimum}),/INVALID_QUANTITY/);
});
test('save captures the owner, blocks double submit and discards responses after account changes',async()=>{
 let release,args;const client={rpc:(_n,p)=>{args=p;return new Promise(r=>release=r);}};const catalog=createInventoryCatalog(client);catalog.setOwner(a);
 const pending=catalog.save(id,0,payload);await assert.rejects(catalog.save(id,0,payload),/SAVE_IN_PROGRESS/);assert.equal(args.p_restaurant,a);
 catalog.setOwner(b);release({data:{id,restaurant_id:a}});await assert.rejects(pending,/SESSION_CHANGED/);
});
