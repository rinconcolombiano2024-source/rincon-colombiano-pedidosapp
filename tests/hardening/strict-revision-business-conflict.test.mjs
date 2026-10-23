import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const original=readFileSync('tests/fixtures/strict-order-revision-production.sql','utf8');
const migration=readFileSync('supabase/migrations/20261023061946_strict_revision_business_conflict.sql','utf8');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const id='33333333-3333-4333-8333-333333333333';
const db=new PGlite();
await db.exec(`create schema auth;create role authenticated;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table orders(id uuid primary key,user_id uuid,ticket_number integer,business_date date,
order_json jsonb,total numeric,created_at timestamptz,updated_at timestamptz,revision bigint,canonical_status text);`);
await db.exec(original);
await db.exec('revoke all on function save_restaurant_order_atomic_strict(uuid,integer,date,jsonb,numeric,timestamptz,bigint) from public; grant execute on function save_restaurant_order_atomic_strict(uuid,integer,date,jsonb,numeric,timestamptz,bigint) to authenticated');
const attrs=async()=> (await db.query(`select proacl::text,prosecdef,proconfig from pg_proc where proname='save_restaurant_order_atomic_strict'`)).rows[0];
const before=await attrs();
const apply=()=>db.exec('begin;'+migration+'commit;');
const actor=uid=>db.query("select set_config('test.uid',$1,false)",[uid]);
const save=(revision,order=id)=>db.query('select * from save_restaurant_order_atomic_strict($1,1,current_date,$2,10,now(),$3)',[order,{description:'unchanged'},revision]);
test.after(()=>db.close());
test('reproduce 40001 then change only business error codes, retaining permissions and idempotence',async()=>{
 await actor(owner);
 await assert.rejects(()=>save(2),e=>e.code==='40001'&&/ORDER_REVISION_CONFLICT/.test(e.message));
 await apply();await apply();
 assert.deepEqual(await attrs(),before);
 const {rows}=await db.query("select prosrc from pg_proc where proname='save_restaurant_order_atomic_strict'");
 assert.equal(rows[0].prosrc,original.split('$function$')[1].replaceAll("errcode = '40001'","errcode = 'P0001'"));
 await assert.rejects(()=>save(2),e=>e.code==='P0001'&&/ORDER_REVISION_CONFLICT/.test(e.message));
 assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,0);
});
test('create and valid update still work; missing, stale and cancelled revisions cannot overwrite data',async()=>{
 await actor(owner);assert.equal((await save(null)).rows[0].revision,1);
 for(const revision of [null,0,2]) await assert.rejects(()=>save(revision),e=>e.code==='P0001'&&/ORDER_REVISION_/.test(e.message));
 assert.equal((await db.query('select revision from orders')).rows[0].revision,1);
 assert.equal((await save(1)).rows[0].revision,2);
 await db.exec("update orders set canonical_status='cancelled'");
 await assert.rejects(()=>save(2),e=>e.code==='P0001'&&/cancelled/.test(e.message));
 assert.equal((await db.query('select revision from orders')).rows[0].revision,2);
});
test('other users and unauthenticated calls remain rejected',async()=>{
 await actor(other);await assert.rejects(()=>save(2),/Order not found/);
 await actor('');await assert.rejects(()=>save(2),/Not authenticated/);
});
test('unknown deployed function body aborts rather than replacing unreviewed code',async()=>{
 await db.exec(original.replace('Invalid ticket number','Changed validation'));
 await assert.rejects(apply,/STRICT_REVISION_RPC_DRIFT/);
 await db.exec('rollback');
 assert.match((await db.query("select prosrc from pg_proc where proname='save_restaurant_order_atomic_strict'")).rows[0].prosrc,/Changed validation/);
});
