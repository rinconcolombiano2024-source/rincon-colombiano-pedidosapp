const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

// PostgreSQL local real (PGlite), sin red, Stripe ni cambios en Supabase.
// Se ejecutan los cuerpos originales de las RPCs y triggers implicados.
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8').replace(/\r\n/g, '\n');
const patch = read('MIGRACION-V91-13-P0-01-ENTREGA-Y-LIBERACION.sql');
const v85 = 'MIGRACION-V85-03-PAGOS-MARKETPLACE.sql';
const v86 = 'MIGRACION-V86-02-PAGOS-SEGUROS-Y-LIQUIDACION.sql';
const v11 = 'MIGRACION-V91-11-INMUTABILIDAD-FINANCIERA-MARKETPLACE.sql';
const v12 = 'MIGRACION-V91-12B-HASH-Y-CERRAR-TOKENS-REVISION-SENIOR-LOCKED.sql';
function fn(file, name) {
  const sql = read(file);
  const start = sql.search(new RegExp(`create or replace function\\s+public\\.${name}\\s*\\(`, 'i'));
  assert.ok(start >= 0, name);
  const end = sql.indexOf('\n$$;', start);
  assert.ok(end > start, name);
  return sql.slice(start, end + 4);
}
function table(file, name) {
  const sql = read(file);
  const start = sql.indexOf(`create table if not exists public.${name} (`);
  assert.ok(start >= 0, name);
  return sql.slice(start, sql.indexOf('\n);', start) + 3);
}
const owner = randomUUID();
const customer = randomUUID();
const courier = randomUUID();
const staff = randomUUID();
const stranger = randomUUID();
const token = 'test-customer-secret-not-the-visible-hash';
const hash = createHash('sha256').update(token).digest('hex');

async function setup(db, variableConflict = 'use_column') {
  // El RPC historico dispatch usa station_status sin alias y tambien como OUT.
  // use_column permite probar su camino funcional sin modificar ese RPC.
  // Un caso separado verifica su error preexistente bajo el valor default error.
  await db.exec(`set plpgsql.variable_conflict = '${variableConflict}'`);
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create schema extensions;
    create extension pgcrypto with schema extensions;
    set search_path = public, extensions;
    insert into auth.users values ('${owner}'), ('${customer}'), ('${courier}'), ('${staff}'), ('${stranger}');
  `);
  for (const name of ['customer_orders', 'orders', 'restaurant_profiles']) {
    await db.exec(table('supabase-schema.sql', name));
  }
  await db.exec(`
    alter table public.restaurant_profiles add column deleted_at timestamptz;
    insert into public.restaurant_profiles(user_id) values ('${owner}');
    alter table public.customer_orders
      add column station_status text default 'dispatched',
      add column payment_method text default 'Online',
      add column payment_status text default 'paid',
      add column cancellation_reason text default '',
      add column cancelled_by uuid, add column cancelled_at timestamptz,
      add column currency text default 'PLN', add column subtotal numeric default 100,
      add column discount_amount numeric default 0, add column tip_amount numeric default 0,
      add column tip_currency text default 'PLN', add column base_delivery_fee numeric default 0,
      add column distance_fee numeric default 0, add column operational_adjustment numeric default 0,
      add column platform_adjustment numeric default 0, add column final_delivery_fee numeric default 0;
    alter table public.orders add column status text default 'sent',
      add column canonical_status text default 'dispatched',
      add column cancelled_at timestamptz, add column cancelled_by uuid,
      add column cancellation_reason text default '';
    create table public.delivery_assignments(
      id uuid primary key, customer_order_id uuid references public.customer_orders(id),
      restaurant_user_id uuid, courier_user_id uuid, status text,
      offer_expires_at timestamptz, delivered_at timestamptz,
      delivered_lat numeric, delivered_lng numeric, updated_at timestamptz default now()
    );
    create table public.courier_live_locations(user_id uuid primary key, lat numeric, lng numeric, available boolean);
    create table public.restaurant_staff_memberships(
      restaurant_user_id uuid, member_user_id uuid, station text, active boolean
    );
    insert into public.restaurant_staff_memberships
      select '${owner}', '${staff}', station, true from unnest(array['dispatch','manager','cashier']) station;
    create table public.order_station_tasks(
      customer_order_id uuid, restaurant_user_id uuid, station text, status text,
      started_at timestamptz, completed_at timestamptz, updated_at timestamptz default now()
    );
    create table public.payment_transactions(
      id uuid primary key, customer_order_id uuid references public.customer_orders(id),
      status text, amount numeric, currency text
    );
  `);
  for (const name of ['marketplace_finance_config', 'marketplace_payment_allocations', 'delivery_completion_confirmations']) {
    await db.exec(table(v85, name));
  }
  await db.exec(`
    insert into public.marketplace_finance_config(id) values (true);
    alter table public.marketplace_payment_allocations
      add column financial_hold boolean not null default false,
      add column hold_reason text not null default '',
      add column refund_amount numeric not null default 0,
      add column dispute_status text not null default '';
  `);
  await db.exec(table(v86, 'marketplace_settlement_jobs'));
  const originals = [
    ['MIGRACION-V91-02-SINCRONIZACION-CANCELACION-PEDIDOS.sql', 'transition_customer_order_status'],
    ['MIGRACION-V91-03-CONTRATO-MULTIESTACION-Y-REALTIME.sql', 'update_my_station_order'],
    ['MIGRACION-V91-01-RENDIMIENTO-INTEGRIDAD-Y-CIERRES.sql', 'update_delivery_assignment_status'],
    [v86, 'rc_ordera_mark_restaurant_release_eligible'],
    [v86, 'rc_ordera_persist_courier_delivery_confirmation'],
    [v86, 'rc_ordera_queue_settlement_job'],
    [v86, 'claim_marketplace_settlement_jobs'],
    [v86, 'complete_marketplace_settlement_job'],
    [v11, 'rc_ordera_calculate_marketplace_allocation'],
    [v12, 'rc_ordera_customer_token_matches'],
    [v12, 'record_delivery_completion_confirmation'],
  ];
  for (const [file, name] of originals) await db.exec(fn(file, name));
  await db.exec(`
    create trigger rc_ordera_v86_restaurant_release_trigger after update of status on public.customer_orders
      for each row execute function public.rc_ordera_mark_restaurant_release_eligible();
    create trigger rc_ordera_v86_courier_confirmation_trigger after update of status on public.delivery_assignments
      for each row execute function public.rc_ordera_persist_courier_delivery_confirmation();
    create trigger rc_ordera_queue_settlement_job_trigger
      after insert or update of status, restaurant_release_eligible_at, courier_release_eligible_at,
        restaurant_transfer_id, courier_transfer_id, financial_hold on public.marketplace_payment_allocations
      for each row execute function public.rc_ordera_queue_settlement_job();
    revoke all on all functions in schema public from public, anon, authenticated;
    grant execute on function public.transition_customer_order_status(uuid,text,text),
      public.update_my_station_order(uuid,uuid,text,text), public.update_delivery_assignment_status(uuid,text)
      to authenticated;
    grant execute on function public.record_delivery_completion_confirmation(uuid,text,text) to anon, authenticated;
    grant execute on all functions in schema public to service_role;
    grant all on all tables in schema public to service_role;
    alter table public.delivery_assignments enable row level security;
    alter table public.delivery_completion_confirmations enable row level security;
    alter table public.marketplace_payment_allocations enable row level security;
  `);
  await db.exec(read('MIGRACION-V91-10-CERRAR-ESCRITURA-DIRECTA-CUSTOMER-ORDERS.sql'));
  await db.exec(read(v11));
  await db.exec(read('MIGRACION-V91-08-CONCILIACION-DISPUTAS.sql'));
}

async function seed(db, type = 'Domicilio', status = 'sent', allocate = true) {
  const order = randomUUID(), assignment = randomUUID(), payment = randomUUID();
  await db.query(`insert into public.customer_orders
    (id, public_token, user_id, customer_user_id, order_type, status, assigned_courier_user_id,
     courier_assignment_status, total) values ($1,$2,$3,$4,$5,$6,$7,'arrived_customer',100)`,
  [order, hash, owner, customer, type, status, courier]);
  await db.query(`insert into public.delivery_assignments
    (id, customer_order_id, restaurant_user_id, courier_user_id, status)
    values ($1,$2,$3,$4,'arrived_customer')`, [assignment, order, owner, courier]);
  await db.query(`insert into public.payment_transactions values ($1,$2,'paid',100,'PLN')`, [payment, order]);
  if (allocate) await db.query('select public.rc_ordera_calculate_marketplace_allocation($1)', [payment]);
  return { order, assignment, payment };
}
async function actor(db, id, sql, params = [], role = 'authenticated') {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || '']);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); }
  finally { await db.exec('reset role'); }
}
async function state(db, order) {
  return (await db.query(`select co.status, co.station_status,
    a.restaurant_release_eligible_at as eligible, a.courier_release_eligible_at as courier_eligible,
    a.financial_hold, a.hold_reason, a.restaurant_net_amount, a.status as allocation_status
    from public.customer_orders co left join public.marketplace_payment_allocations a
    on a.customer_order_id=co.id where co.id=$1`, [order])).rows[0];
}
async function deliver(db, order) {
  await actor(db, courier, 'select public.update_delivery_assignment_status($1,$2)', [order.assignment, 'delivered']);
}
async function confirm(db, order, id = customer, publicToken = '', role = 'authenticated') {
  return actor(db, id, 'select * from public.record_delivery_completion_confirmation($1,$2,$3)',
    [order.order, publicToken, 'customer'], role);
}
async function invariants(db) {
  return (await db.query(`select p.oid::regprocedure::text as name, pg_get_functiondef(p.oid) as definition,
    p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' order by 1`)).rows;
}

test('P0-01: entrega y elegibilidad, con RPCs originales y PostgreSQL local', async t => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await setup(db);
    // Filas historicas deliberadamente vulnerables, creadas ANTES del parche.
    const legacy = await seed(db, 'Domicilio', 'delivered');
    const alreadyTransferred = await seed(db, 'Domicilio', 'delivered');
    await db.query(`update public.marketplace_payment_allocations set restaurant_transfer_id='tr_history',
      restaurant_transferred_at=now() where customer_order_id=$1`, [alreadyTransferred.order]);
    const originals = await invariants(db);
    const security = async () => (await db.query(`select c.relname, c.relrowsecurity, c.relacl::text,
      (select jsonb_agg(row_to_json(p)) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' order by c.relname`)).rows;
    const previousSecurity = await security();
    const baseline = new Map();
    for (const type of ['Comer en el punto', 'Recoger en el punto']) {
      for (const station of ['restaurant', 'dispatch', 'manager', 'cashier']) {
        const order = await seed(db, type);
        if (station === 'restaurant') {
          await actor(db, owner, 'select * from public.transition_customer_order_status($1,$2)', [order.order, 'delivered']);
        } else {
          await actor(db, staff, 'select * from public.update_my_station_order($1,$2,$3,$4)', [owner, order.order, 'completed', station]);
        }
        const row = await state(db, order.order);
        baseline.set(`${type}/${station}`, { ...row, eligible: !!row.eligible });
      }
    }
    await db.exec(patch);

    await t.test('migracion idempotente, sin cambiar RPCs, precios, permisos ni RLS previos', async () => {
      assert.equal((await state(db, legacy.order)).eligible, null);
      assert.ok((await state(db, alreadyTransferred.order)).eligible);
      await db.exec(patch);
      const now = new Map((await invariants(db)).map(row => [row.name, row]));
      for (const original of originals) assert.deepEqual(now.get(original.name), original);
      assert.deepEqual(await security(), previousSecurity);
      for (const name of ['rc_ordera_guard_delivery_completed()', 'rc_ordera_delivery_release_proven(uuid)',
        'rc_ordera_guard_delivery_release()', 'rc_ordera_release_confirmed_delivery()']) {
        for (const role of ['anon', 'authenticated']) {
          const result = await db.query('select has_function_privilege($1,$2,\'EXECUTE\') as allowed', [role, `public.${name}`]);
          assert.equal(result.rows[0].allowed, false);
        }
      }
    });

    await t.test('restaurante no puede completar Domicilio por transition_customer_order_status', async () => {
      const order = await seed(db);
      const before = await state(db, order.order);
      await assert.rejects(actor(db, owner, 'select * from public.transition_customer_order_status($1,$2)',
        [order.order, 'delivered']), { code: '42501', message: 'DELIVERY_CONFIRMATION_REQUIRED' });
      assert.deepEqual(await state(db, order.order), before);
    });

    for (const station of ['dispatch', 'manager', 'cashier']) {
      await t.test(`${station}: completed no falsifica entrega ni habilita pago`, async () => {
        const order = await seed(db);
        const before = await state(db, order.order);
        await assert.rejects(actor(db, staff, 'select * from public.update_my_station_order($1,$2,$3,$4)',
          [owner, order.order, 'completed', station]), { code: '42501' });
        assert.deepEqual(await state(db, order.order), before);
      });
    }

    await t.test('restaurante tampoco puede completar mediante el RPC del repartidor', async () => {
      const order = await seed(db);
      await assert.rejects(actor(db, owner, 'select public.update_delivery_assignment_status($1,$2)',
        [order.assignment, 'delivered']), /Only the assigned courier/);
      assert.equal((await state(db, order.order)).status, 'sent');
    });

    await t.test('entrega legitima funciona; solo courier no libera restaurante; cliente confirma una vez', async () => {
      const order = await seed(db);
      await deliver(db, order);
      let row = await state(db, order.order);
      assert.equal(row.status, 'delivered');
      assert.equal(row.eligible, null);
      assert.equal(row.courier_eligible, null);
      await assert.rejects(confirm(db, order, owner), /Not authorized/);
      const result = await confirm(db, order);
      assert.deepEqual(result.rows[0], { courier_confirmed: true, customer_confirmed: true, settlement_eligible: true });
      row = await state(db, order.order);
      assert.ok(row.eligible);
      assert.ok(row.courier_eligible);
      assert.equal(Number(row.restaurant_net_amount), 95);
      await confirm(db, order);
      assert.deepEqual(await state(db, order.order), row);
      const jobs = await db.query(`select count(*)::int as n from public.marketplace_settlement_jobs j
        join public.marketplace_payment_allocations a on a.id=j.allocation_id where a.customer_order_id=$1`, [order.order]);
      assert.equal(jobs.rows[0].n, 1);
    });

    await t.test('token V91-12: hash visible/invalido no confirma; token legitimo de invitado si', async () => {
      const order = await seed(db);
      await db.query('update public.customer_orders set customer_user_id=null where id=$1', [order.order]);
      await deliver(db, order);
      await assert.rejects(confirm(db, order, null, hash, 'anon'), /Not authorized/);
      await assert.rejects(confirm(db, order, null, 'invalid-token', 'anon'), /Not authorized/);
      assert.equal((await state(db, order.order)).eligible, null);
      await confirm(db, order, null, token, 'anon');
      assert.ok((await state(db, order.order)).eligible);
    });

    await t.test('ruta Edge service_role no vuelve elegible un delivered historico sin prueba', async () => {
      await actor(db, null, `update public.marketplace_payment_allocations set restaurant_release_eligible_at=now(),
        updated_at=now() where customer_order_id=$1 and restaurant_release_eligible_at is null`, [legacy.order], 'service_role');
      assert.equal((await state(db, legacy.order)).eligible, null);
      // Mismo predicado que marketplace-settlement antes de transferir al restaurante.
      const candidates = await db.query(`select count(*)::int as n from public.marketplace_payment_allocations
        where customer_order_id=$1 and restaurant_release_eligible_at is not null
          and restaurant_transfer_id='' and restaurant_net_amount>0`, [legacy.order]);
      assert.equal(candidates.rows[0].n, 0);
    });

    await t.test('ningun actor puede fabricar la prueba mediante escritura directa', async () => {
      const order = await seed(db);
      for (const id of [owner, staff, stranger]) {
        await assert.rejects(actor(db, id,
          "update public.delivery_assignments set status='delivered', delivered_at=now() where id=$1",
          [order.assignment]), { code: '42501' });
        await assert.rejects(actor(db, id,
          'insert into public.delivery_completion_confirmations(customer_order_id, delivery_assignment_id, courier_user_id, courier_confirmed_at, customer_confirmed_at, completed_at) values($1,$2,$3,now(),now(),now())',
          [order.order, order.assignment, id]), { code: '42501' });
        await assert.rejects(actor(db, id,
          'update public.marketplace_payment_allocations set restaurant_release_eligible_at=now() where customer_order_id=$1',
          [order.order]), { code: '42501' });
      }
      assert.equal((await state(db, order.order)).eligible, null);
    });

    await t.test('asignacion sin entrega o confirmacion incompleta no libera pago', async () => {
      const order = await seed(db);
      await deliver(db, order);
      for (const field of ['courier_confirmed_at', 'customer_confirmed_at', 'completed_at']) {
        const stamps = ['courier_confirmed_at', 'customer_confirmed_at', 'completed_at']
          .map(name => `${name}=${name === field ? 'null' : 'now()'}`).join(',');
        await db.query(`update public.delivery_completion_confirmations set ${stamps} where customer_order_id=$1`, [order.order]);
        await actor(db, null, 'update public.marketplace_payment_allocations set restaurant_release_eligible_at=now() where customer_order_id=$1', [order.order], 'service_role');
        assert.equal((await state(db, order.order)).eligible, null);
      }
      await db.query("update public.delivery_assignments set status='arrived_customer', delivered_at=null where id=$1", [order.assignment]);
      await db.query(`update public.delivery_completion_confirmations set courier_confirmed_at=now(),
        customer_confirmed_at=now(), completed_at=now() where customer_order_id=$1`, [order.order]);
      assert.equal((await state(db, order.order)).eligible, null);
    });

    await t.test('allocation tardia y ON CONFLICT no liberan delivered sin prueba', async () => {
      await actor(db, null, 'select public.rc_ordera_calculate_marketplace_allocation($1)', [legacy.payment], 'service_role');
      assert.equal((await state(db, legacy.order)).eligible, null);
      await db.query('delete from public.marketplace_settlement_jobs where allocation_id in (select id from public.marketplace_payment_allocations where customer_order_id=$1)', [legacy.order]);
      await db.query('delete from public.marketplace_payment_allocations where customer_order_id=$1', [legacy.order]);
      await actor(db, null, 'select public.rc_ordera_calculate_marketplace_allocation($1)', [legacy.payment], 'service_role');
      assert.equal((await state(db, legacy.order)).eligible, null);
    });

    await t.test('disputa won no habilita restaurante sin prueba, ni altera conciliacion', async () => {
      for (const [status, created] of [['needs_response', 1], ['won', 2]]) {
        await actor(db, null, 'select public.rc_ordera_reconcile_payment_dispute($1,$2,$3,$4)',
          [legacy.payment, 'du_P0Test', status, created], 'service_role');
      }
      const row = await state(db, legacy.order);
      assert.equal(row.financial_hold, false);
      assert.equal(row.eligible, null);
    });

    await t.test('prueba de otra asignacion/repartidor/cliente no habilita restaurante', async () => {
      const order = await seed(db);
      const other = await seed(db);
      await deliver(db, order);
      await deliver(db, other);
      for (const [column, value] of [['delivery_assignment_id', other.assignment], ['courier_user_id', stranger], ['customer_user_id', stranger]]) {
        await db.query(`update public.delivery_completion_confirmations set delivery_assignment_id=$2,
          courier_user_id=$3, customer_user_id=$4, customer_confirmed_at=null, completed_at=null where customer_order_id=$1`,
          [order.order, order.assignment, courier, customer]);
        await db.query(`update public.delivery_completion_confirmations set ${column}=$2,
          customer_confirmed_at=now(), completed_at=now() where customer_order_id=$1`, [order.order, value]);
        await actor(db, null, 'update public.marketplace_payment_allocations set restaurant_release_eligible_at=now() where customer_order_id=$1', [order.order], 'service_role');
        assert.equal((await state(db, order.order)).eligible, null);
      }
    });

    await t.test('confirmacion no levanta hold financiero ni cambia importes', async () => {
      const order = await seed(db);
      await db.query(`update public.marketplace_payment_allocations set financial_hold=true, hold_reason='manual'
        where customer_order_id=$1`, [order.order]);
      await deliver(db, order);
      await confirm(db, order);
      const row = await state(db, order.order);
      assert.equal(row.financial_hold, true);
      assert.equal(row.hold_reason, 'manual');
      assert.equal(row.eligible, null);
      assert.equal(Number(row.restaurant_net_amount), 95);
    });

    await t.test('confirmacion previa a allocation conserva liberacion legitima posterior', async () => {
      const order = await seed(db, 'Domicilio', 'sent', false);
      await deliver(db, order);
      await confirm(db, order);
      await actor(db, null, 'select public.rc_ordera_calculate_marketplace_allocation($1)', [order.payment], 'service_role');
      assert.ok((await state(db, order.order)).eligible);
    });

    for (const type of ['Comer en el punto', 'Recoger en el punto']) {
      for (const station of ['restaurant', 'dispatch', 'manager', 'cashier']) {
        await t.test(`${type}/${station}: delivered y elegibilidad conservan resultado anterior`, async () => {
          const order = await seed(db, type);
          if (station === 'restaurant') {
            await actor(db, owner, 'select * from public.transition_customer_order_status($1,$2)', [order.order, 'delivered']);
          } else {
            await actor(db, staff, 'select * from public.update_my_station_order($1,$2,$3,$4)', [owner, order.order, 'completed', station]);
          }
          const row = await state(db, order.order);
          assert.deepEqual({ ...row, eligible: !!row.eligible }, baseline.get(`${type}/${station}`));
          assert.equal(row.status, 'delivered');
          assert.equal(row.station_status, 'completed');
          assert.ok(row.eligible);
          assert.equal(Number(row.restaurant_net_amount), 95);
          const proof = await db.query('select count(*)::int as n from public.delivery_completion_confirmations where customer_order_id=$1', [order.order]);
          assert.equal(proof.rows[0].n, 0);
        });
      }
    }

    await t.test('Domicilio conserva envio/cancelacion y bloqueo financiero V91-11', async () => {
      const order = await seed(db, 'Domicilio', 'accepted');
      await actor(db, owner, 'select * from public.transition_customer_order_status($1,$2)', [order.order, 'sent']);
      assert.equal((await state(db, order.order)).status, 'sent');
      await assert.rejects(db.query('update public.customer_orders set total=1 where id=$1', [order.order]), /MARKETPLACE_PRICING_LOCKED/);
      await actor(db, owner, 'select * from public.transition_customer_order_status($1,$2,$3)', [order.order, 'cancelled', 'test']);
      assert.equal((await state(db, order.order)).status, 'cancelled');
    });

    await t.test('preflight falla cerrado si la prueba puede ser falsificada; rollback sin cambios', async () => {
      const definitions = await invariants(db);
      await db.exec('grant update(customer_confirmed_at) on public.delivery_completion_confirmations to authenticated');
      await assert.rejects(db.exec(patch), /conserva escritura directa/);
      await db.exec('rollback');
      await db.exec('revoke update(customer_confirmed_at) on public.delivery_completion_confirmations from authenticated');
      assert.deepEqual(await invariants(db), definitions);
    });
  } finally {
    await db.close();
  }
});

test('dispatch con configuracion PostgreSQL default: el parche no cambia el error historico 42702', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await setup(db, 'error');
    for (const phase of ['before', 'after']) {
      if (phase === 'after') await db.exec(patch);
      for (const type of ['Domicilio', 'Comer en el punto', 'Recoger en el punto']) {
        const order = await seed(db, type);
        await assert.rejects(actor(db, staff, 'select * from public.update_my_station_order($1,$2,$3,$4)',
          [owner, order.order, 'completed', 'dispatch']), { code: '42702' });
        assert.equal((await state(db, order.order)).status, 'sent');
        assert.equal((await state(db, order.order)).eligible, null);
      }
    }
  } finally { await db.close(); }
});
