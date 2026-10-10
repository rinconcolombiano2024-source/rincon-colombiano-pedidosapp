import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
for(const f of ['MIGRACION-V86-04-TRADUCCIONES-SEGURAS.sql','MIGRACION-V5-20261010-08-TRANSLATION-GLOBAL-CAP.sql','MIGRACION-V5-20261010-09-TRANSLATION-BUDGET-FENCE.sql'])await db.exec(readFileSync(f,'utf8'));
test.after(()=>db.close());
const hash=i=>i.toString(16).padStart(64,'0');
const quota=async(i,h=120,gh=100,gd=100)=> (await db.query('select rc_ordera_consume_translation_quota_v2($1,$2,$3,$4) q',[hash(i),h,gh,gd])).rows[0].q;
const clear=()=>db.exec('TRUNCATE translation_request_limits,translation_global_limits');
test('actual SQL: global denial bounds rotating identities and consumes exactly 100 credits',async()=>{
 await clear();const r=await Promise.all(Array.from({length:200},(_,i)=>quota(i)));
 assert.equal(r.filter(x=>x==='ok').length,100);assert.equal(r.filter(x=>x==='global_limit').length,100);
 assert.equal((await db.query('select count(*)::int n from translation_request_limits')).rows[0].n,100);
 assert.equal((await db.query('select sum(request_count)::int n from translation_global_limits')).rows[0].n,100);
 // PGlite serializes calls; independent PostgreSQL transactions remain a staging gate.
});
test('actual SQL: exhausted per-client counters stay capped, without overflow',async()=>{
 await clear();for(let i=0;i<10;i++)assert.equal(await quota(1,10),'ok');
 for(let i=0;i<100;i++)assert.equal(await quota(1,10),'client_limit');
 assert.equal((await db.query('select request_count from translation_request_limits')).rows[0].request_count,10);
 await db.query('update translation_request_limits set request_count=2147483647');assert.equal(await quota(1,10),'client_limit');
});
test('actual SQL: oldest partial hour remains in conservative daily budget',async()=>{
 await clear();await db.exec("insert into translation_global_limits values(date_trunc('hour',now()-interval '24 hours','UTC'),100)");
 assert.equal(await quota(1),'global_limit');assert.equal((await db.query('select count(*)::int n from translation_request_limits')).rows[0].n,0);
});
test('actual SQL: bounded cleanup deletes exactly 200 stale identities and at most 72 buckets',async()=>{
 await clear();await db.exec("insert into translation_request_limits select lpad(to_hex(i),64,'0'),now()-interval '3 hours',1,now() from generate_series(1,450) i; insert into translation_global_limits select date_trunc('hour',now(),'UTC')-i*interval '1 hour',1 from generate_series(100,200) i");
 assert.equal(await quota(999),'ok');assert.equal((await db.query('select count(*)::int n from translation_request_limits')).rows[0].n,251);
 assert.equal((await db.query('select count(*)::int n from translation_global_limits')).rows[0].n,30);
});
test('actual SQL: private quotas reject anon/authenticated and reject invalid hashes',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec(`SET ROLE ${role}`);await assert.rejects(()=>quota(1),/permission denied/);await assert.rejects(()=>db.query('select * from translation_global_limits'),/permission denied/);await db.exec('RESET ROLE');
 }
 await assert.rejects(()=>db.query("select rc_ordera_consume_translation_quota_v2('spoofed')"),/INVALID_CLIENT_HASH/);
 await db.exec('SET ROLE service_role');await clear().catch(()=>{});assert.ok(['ok','global_limit','client_limit'].includes(await quota(999)));await db.exec('RESET ROLE');
});
test('migration rejects unexpected function drift and can be reapplied unchanged',async()=>{
 const sql=readFileSync('MIGRACION-V5-20261010-09-TRANSLATION-BUDGET-FENCE.sql','utf8');await db.exec(sql);
 await db.exec("CREATE OR REPLACE FUNCTION public.rc_ordera_consume_translation_quota_v2(p_client_hash text,p_hourly_limit integer DEFAULT 120,p_global_hourly_limit integer DEFAULT 2000,p_global_daily_limit integer DEFAULT 10000) RETURNS text LANGUAGE sql AS $$ SELECT 'unsafe'::text $$");
 await assert.rejects(()=>db.exec(sql),/Unexpected quota v2 body/);await db.exec('ROLLBACK');
});
