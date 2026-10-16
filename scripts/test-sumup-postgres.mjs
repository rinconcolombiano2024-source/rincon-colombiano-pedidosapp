// Disposable PostgreSQL 17 integration test. No production URLs or credentials.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {bootstrap, setupOrders, R, B} from '../tests/support/v5-fixtures.mjs';

const run = promisify(execFile);
if (process.env.RC_TEST_CONFIRM_DISPOSABLE_POSTGRES !== 'YES' ||
    process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'rc_ordera_ci' ||
    process.env.PGPORT !== '55432') {
  throw new Error('Requires explicit disposable localhost PostgreSQL fixture on port 55432');
}
const env = {...process.env, PGUSER:'postgres', PGSSLMODE:'disable',
  PGSERVICE:'', PGSERVICEFILE:'/dev/null', PGPASSFILE:'/dev/null',
  PGOPTIONS:'-c statement_timeout=15000 -c lock_timeout=5000'};
async function sql(source) {
  try {
    const {stdout} = await run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', source],
      {env, timeout:20000, maxBuffer:2*1024*1024});
    return stdout.trim();
  } catch (error) {
    throw new Error(String(error.stderr || error.message));
  }
}
// Only locally generated fixtures are interpolated, always quoted as literals.
const quote = value => value === null ? 'NULL' : "'" + String(value).replaceAll("'", "''") + "'";
const qid = value => quote(value) + '::uuid';
const json = value => quote(JSON.stringify(value)) + '::jsonb';
const parse = source => sql(source).then(JSON.parse);
const migration = name => readFileSync(name, 'utf8');
assert.equal(await sql("select count(*) from information_schema.tables where table_schema='public'"), '0',
  'Refuse to modify a database that already contains application tables');
assert.match(await sql('show server_version'), /^17\./);
await bootstrap({exec:sql});
await setupOrders({exec:sql});
await sql(migration('tests/fixtures/deployed-20261011/customer-edge.sql'));
await sql(`
  revoke all on function public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric) from public,anon,authenticated;
  grant execute on function public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric) to service_role;
  alter table customer_orders add column canonical_status text not null default 'created',
    add column payment_provider text not null default '', add column provider_reference text not null default '',
    add column paid_at timestamptz;
  create table payment_transactions (
    id uuid primary key default gen_random_uuid(), customer_order_id uuid not null references customer_orders(id),
    provider text not null, provider_reference text not null, payment_method text not null,
    status text not null, amount numeric not null, currency text not null,
    idempotency_key text not null, provider_session_id text not null, paid_at timestamptz,
    unique(customer_order_id,idempotency_key)
  );
`);
const ledger = migration('MIGRACION-V91-73-SUMUP-SINGLE-MERCHANT-LEDGER.sql');
const entry = migration('MIGRACION-V91-74-SUMUP-ORDER-ENTRY.sql');
await assert.rejects(sql(entry), /SUMUP_ORDER_ENTRY_PREREQUISITES_MISSING/);
await sql(ledger);
await sql(entry);
const entryDefinition = () => sql("select pg_get_functiondef('public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric)'::regprocedure)");
const installedDefinition = await entryDefinition();
await sql(entry);
assert.equal(await entryDefinition(), installedDefinition);

const notes = ['SIN AZÚCAR', 'SIN HIELO'];
const orderPayload = {paymentMethod:'Online', items:notes.map(note => ({product_id:'dish',quantity:1,price:0.01,note}))};
async function createOrder({provider='sumup', mode='Recoger en el punto', extra={}}={}) {
  await sql(`update app_settings set settings=jsonb_build_object('onlinePaymentProvider',${quote(provider)}) where user_id=${qid(R)}`);
  const id=randomUUID();
  await sql(`set role service_role; select * from public.rc_ordera_create_customer_order_edge(
    ${qid(id)},${qid(R)},'synthetic-private-order-token','test','CI customer',${quote(mode)},
    ${json({...orderPayload,...extra})},null,0.01)`);
  return id;
}
await assert.rejects(createOrder({provider:'disabled'}), /Online payment is unavailable/);
await assert.rejects(createOrder({mode:'Domicilio'}), /Online payment is unavailable/);
await assert.rejects(createOrder({extra:{tipAmount:1}}), /Online payment is unavailable/);
await sql(`update restaurant_profiles set country_code='CO' where user_id=${qid(R)}`);
await assert.rejects(createOrder(), /Online payment is unavailable/);
await sql(`update restaurant_profiles set country_code='PL' where user_id=${qid(R)}`);
await createOrder({provider:'stripe'});
await createOrder({provider:'disabled',extra:{paymentMethod:'Efectivo'}});
const order=await createOrder();
const row=await parse(`select json_build_object('total',total,'status',payment_status,'items',order_json->'items') from customer_orders where id=${qid(order)}`);
assert.equal(row.total,31); assert.equal(row.status,'pending');
assert.deepEqual(row.items.map(item=>item.options_snapshot.note),notes);
assert.deepEqual(row.items.map(item=>item.unit_price_snapshot),[15.5,15.5]);

const reserve = owner => `select public.rc_sumup_reserve_checkout(${qid(order)},${qid(owner)},'MCXXXXXX')`;
await assert.rejects(sql('set role service_role; '+reserve(B)), /SUMUP_ORDER_NOT_ELIGIBLE/);
// Each call is a separate OS process and PostgreSQL connection; the sleep holds
// the first transaction's row lock so requests overlap rather than run serially.
const reservations=await Promise.all(Array.from({length:20},async()=>{
  const output=await sql('begin; set local role service_role; '+reserve(R)+'; select pg_sleep(0.15); commit;');
  return JSON.parse(output);
}));
assert.equal(reservations.filter(x=>x.creationAllowed===true).length,1);
assert.equal(new Set(reservations.map(x=>x.attemptId)).size,1);
assert.ok(reservations.every(x=>x.amountMinor===3100));
const attempt=reservations[0].attemptId, checkout=randomUUID(), page=randomUUID();
const hosted='https://checkout.sumup.com/pay/'+page;
const commit = url => `select public.rc_sumup_commit_checkout(${qid(attempt)},${qid(checkout)},${quote(url)})`;
for (const url of [null, '', hosted+'?evil=1',hosted+'\n',hosted.replace('sumup.com','sumup.com.evil.invalid')]) {
  await assert.rejects(sql('set role service_role; '+commit(url)), /SUMUP_PROVIDER_CHECKOUT_MISMATCH/);
}
assert.equal(await sql(`select status from rc_sumup_payment_attempts where id=${qid(attempt)}`),'creating');
await sql('set role service_role; '+commit(hosted));
assert.equal(await sql(`select hosted_url from rc_sumup_payment_attempts where id=${qid(attempt)}`),hosted);
const apply = status => `select public.rc_sumup_apply_verified_checkout(${qid(checkout)},${quote(status)})`;
await assert.rejects(sql('set role service_role; '+apply(null)), /SUMUP_UNKNOWN_PROVIDER_STATUS/);
// Exercise the reservation/webhook lock order concurrently while still pending.
await Promise.all(Array.from({length:20},(_,i)=>sql('set role service_role; '+(i%2 ? reserve(R) : apply('PENDING')))));
await assert.rejects(sql(`update customer_orders set status='cancelled' where id=${qid(order)}`), /SUMUP_RECONCILIATION_REQUIRED/);
const paid=await Promise.all(Array.from({length:20},()=>parse('set role service_role; '+apply('PAID'))));
assert.equal(paid.filter(x=>x.idempotent===false).length,1);
assert.ok(paid.every(x=>x.status==='paid'));
const result=await parse(`select json_build_object('count',count(*),'amount',sum(amount),'provider',min(provider)) from payment_transactions where customer_order_id=${qid(order)}`);
assert.deepEqual(result,{count:1,amount:31,provider:'sumup'});
assert.equal(await sql(`select payment_status from customer_orders where id=${qid(order)}`),'paid');
for (const role of ['anon','authenticated']) {
  for (const statement of ['select * from rc_sumup_payment_attempts',reserve(R),commit(hosted),apply('PAID')]) {
    await assert.rejects(sql(`set role ${role}; ${statement}`), /permission denied/i);
  }
}
// Repeat the unapplied ledger migration only in this disposable fixture; verify
// it preserves existing financial records, RLS and the replay result.
await sql(ledger);
assert.equal((await parse('set role service_role; '+apply('PAID'))).idempotent,true);
assert.equal(await sql(`select count(*) from payment_transactions where customer_order_id=${qid(order)}`),'1');
assert.equal(await sql("select relrowsecurity from pg_class where oid='public.rc_sumup_payment_attempts'::regclass"),'t');
console.log(JSON.stringify({postgres:17,concurrentReservations:20,providerCreationPermissions:1,
  mixedLockOperations:20,concurrentConfirmations:20,recordedPayments:1,amountPLN:31,
  independentNotes:2,clientRolesDenied:2,productionTouched:false,providerSandboxTested:false}));
