-- RC ORDERA V85.02
-- Estaciones por producto, turnos de empleados y cierres operativos.
-- Incremental e idempotente: no elimina pedidos, menus, usuarios ni restaurantes.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.customer_orders') is null
     or to_regclass('public.restaurant_staff_memberships') is null
     or to_regclass('public.restaurant_staff_invitations') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.app_settings') is null
     or to_regclass('public.platform_audit_logs') is null then
    raise exception 'Falta la base operativa. Ejecuta las migraciones V71, V76 y V82 antes de V85.02.';
  end if;
end;
$$;

alter table public.restaurant_staff_memberships
  drop constraint if exists restaurant_staff_memberships_station_check;
alter table public.restaurant_staff_memberships
  add constraint restaurant_staff_memberships_station_check check (
    station in (
      'waiter', 'cashier', 'manager', 'kitchen', 'grill', 'drinks',
      'fast_food', 'starters', 'salads', 'packing', 'dispatch'
    )
  ) not valid;
alter table public.restaurant_staff_memberships
  validate constraint restaurant_staff_memberships_station_check;

alter table public.restaurant_staff_invitations
  drop constraint if exists restaurant_staff_invitations_station_check;
alter table public.restaurant_staff_invitations
  add constraint restaurant_staff_invitations_station_check check (
    station in (
      'waiter', 'cashier', 'manager', 'kitchen', 'grill', 'drinks',
      'fast_food', 'starters', 'salads', 'packing', 'dispatch'
    )
  ) not valid;
alter table public.restaurant_staff_invitations
  validate constraint restaurant_staff_invitations_station_check;

alter table public.customer_orders
  drop constraint if exists customer_orders_source_check;
alter table public.customer_orders
  add constraint customer_orders_source_check
  check (source in ('customer', 'waiter', 'pos')) not valid;
alter table public.customer_orders
  validate constraint customer_orders_source_check;

create table if not exists public.order_station_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders(id) on delete restrict,
  restaurant_user_id uuid not null references auth.users(id) on delete restrict,
  station text not null check (
    station in ('kitchen', 'grill', 'drinks', 'fast_food', 'starters', 'salads', 'packing')
  ),
  status text not null default 'received' check (
    status in ('blocked', 'received', 'preparing', 'ready', 'packed', 'cancelled')
  ),
  items jsonb not null default '[]'::jsonb,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_order_id, station)
);

create index if not exists order_station_tasks_restaurant_status_idx
  on public.order_station_tasks (restaurant_user_id, station, status, created_at);

create table if not exists public.employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete restrict,
  member_user_id uuid not null references auth.users(id) on delete restrict,
  membership_station text not null,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz null,
  clock_in_source text not null default 'employee_app',
  clock_out_source text null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at)
);

create unique index if not exists employee_time_entries_one_open_idx
  on public.employee_time_entries (restaurant_user_id, member_user_id)
  where clock_out_at is null;
create index if not exists employee_time_entries_report_idx
  on public.employee_time_entries (restaurant_user_id, member_user_id, clock_in_at desc);

create table if not exists public.waiter_daily_closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete restrict,
  member_user_id uuid not null references auth.users(id) on delete restrict,
  business_date date not null,
  report_snapshot jsonb not null default '{}'::jsonb,
  closed_at timestamptz not null default now(),
  unique (restaurant_user_id, member_user_id, business_date)
);

create table if not exists public.waiter_monthly_closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete restrict,
  member_user_id uuid not null references auth.users(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  report_snapshot jsonb not null default '{}'::jsonb,
  closed_at timestamptz not null default now(),
  unique (restaurant_user_id, member_user_id, period_start)
);

create table if not exists public.restaurant_period_closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete restrict,
  period_type text not null check (period_type in ('day', 'month', 'year')),
  period_start date not null,
  period_end date not null,
  report_snapshot jsonb not null default '{}'::jsonb,
  closed_by_user_id uuid not null references auth.users(id) on delete restrict,
  closed_at timestamptz not null default now(),
  unique (restaurant_user_id, period_type, period_start)
);

alter table public.order_station_tasks enable row level security;
alter table public.employee_time_entries enable row level security;
alter table public.waiter_daily_closures enable row level security;
alter table public.waiter_monthly_closures enable row level security;
alter table public.restaurant_period_closures enable row level security;

drop policy if exists "Station staff read assigned tasks" on public.order_station_tasks;
create policy "Station staff read assigned tasks"
on public.order_station_tasks for select to authenticated
using (
  auth.uid() = restaurant_user_id
  or exists (
    select 1 from public.restaurant_staff_memberships m
    where m.restaurant_user_id = order_station_tasks.restaurant_user_id
      and m.member_user_id = auth.uid()
      and m.active = true
      and (m.station = order_station_tasks.station or m.station in ('manager', 'cashier'))
  )
);

drop policy if exists "Employees read own time entries" on public.employee_time_entries;
create policy "Employees read own time entries"
on public.employee_time_entries for select to authenticated
using (auth.uid() = member_user_id or auth.uid() = restaurant_user_id);

drop policy if exists "Employees read own daily closures" on public.waiter_daily_closures;
create policy "Employees read own daily closures"
on public.waiter_daily_closures for select to authenticated
using (auth.uid() = member_user_id or auth.uid() = restaurant_user_id);

drop policy if exists "Employees read own monthly closures" on public.waiter_monthly_closures;
create policy "Employees read own monthly closures"
on public.waiter_monthly_closures for select to authenticated
using (auth.uid() = member_user_id or auth.uid() = restaurant_user_id);

drop policy if exists "Owners read restaurant closures" on public.restaurant_period_closures;
create policy "Owners read restaurant closures"
on public.restaurant_period_closures for select to authenticated
using (auth.uid() = restaurant_user_id);

create or replace function public.rc_ordera_normalize_station(p_station text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case lower(trim(coalesce(p_station, '')))
    when 'grill' then 'grill'
    when 'drinks' then 'drinks'
    when 'fast_food' then 'fast_food'
    when 'starters' then 'starters'
    when 'salads' then 'salads'
    else 'kitchen'
  end;
$$;

create or replace function public.rc_ordera_order_item_station(
  p_restaurant_user_id uuid,
  p_item jsonb
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_station text := coalesce(
    p_item->>'station',
    p_item #>> '{options_snapshot,station}',
    ''
  );
  v_product_id text := trim(coalesce(p_item->>'product_id', p_item->>'productId', ''));
begin
  if lower(trim(v_station)) in ('kitchen', 'grill', 'drinks', 'fast_food', 'starters', 'salads') then
    return public.rc_ordera_normalize_station(v_station);
  end if;

  select coalesce(dish.value->>'station', dish.value->>'preparationStation', 'kitchen')
  into v_station
  from public.app_settings s
  cross join lateral jsonb_each(coalesce(s.menu, '{}'::jsonb)) category
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(category.value) = 'array' then category.value else '[]'::jsonb end
  ) dish
  where s.user_id = p_restaurant_user_id
    and trim(coalesce(dish.value->>'id', dish.value->>'productId', '')) = v_product_id
  limit 1;

  return public.rc_ordera_normalize_station(v_station);
end;
$$;

create or replace function public.rc_ordera_sync_order_station_tasks(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.customer_orders%rowtype;
  v_item jsonb;
  v_station text;
  v_groups jsonb := '{}'::jsonb;
  v_group record;
begin
  select co.* into v_order
  from public.customer_orders co
  where co.id = p_order_id;
  if not found then return; end if;

  if v_order.status in ('cancelled', 'rejected') then
    update public.order_station_tasks
    set status = 'cancelled', completed_at = coalesce(completed_at, now()), updated_at = now()
    where customer_order_id = v_order.id and status <> 'cancelled';
    return;
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(v_order.order_json->'items', '[]'::jsonb))
  loop
    v_station := public.rc_ordera_order_item_station(v_order.user_id, v_item);
    v_groups := jsonb_set(
      v_groups,
      array[v_station],
      coalesce(v_groups->v_station, '[]'::jsonb)
        || jsonb_build_array(v_item || jsonb_build_object('station', v_station)),
      true
    );
  end loop;

  for v_group in select key, value from jsonb_each(v_groups)
  loop
    insert into public.order_station_tasks (
      customer_order_id, restaurant_user_id, station, status, items, updated_at
    ) values (
      v_order.id, v_order.user_id, v_group.key,
      case when v_order.station_status in ('ready', 'packed', 'dispatched', 'completed') then 'ready' else 'received' end,
      v_group.value, now()
    )
    on conflict (customer_order_id, station) do update
    set items = excluded.items,
        updated_at = now();
  end loop;

  if jsonb_object_length(v_groups) > 0 then
    insert into public.order_station_tasks (
      customer_order_id, restaurant_user_id, station, status, items, updated_at
    ) values (
      v_order.id, v_order.user_id, 'packing',
      case when v_order.station_status in ('ready', 'packed', 'dispatched', 'completed') then 'received' else 'blocked' end,
      coalesce(v_order.order_json->'items', '[]'::jsonb), now()
    )
    on conflict (customer_order_id, station) do update
    set items = excluded.items,
        updated_at = now();
  end if;
end;
$$;

create or replace function public.rc_ordera_sync_order_station_tasks_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.rc_ordera_sync_order_station_tasks(new.id);
  return new;
end;
$$;

drop trigger if exists rc_ordera_order_station_tasks_trigger on public.customer_orders;
create trigger rc_ordera_order_station_tasks_trigger
after insert or update of order_json, status on public.customer_orders
for each row execute function public.rc_ordera_sync_order_station_tasks_trigger();

select public.rc_ordera_sync_order_station_tasks(co.id)
from public.customer_orders co
where co.created_at >= now() - interval '36 hours'
  and co.status not in ('cancelled', 'rejected', 'delivered');

create or replace function public.activate_restaurant_staff_membership_internal(
  p_restaurant_id uuid,
  p_staff_user_id uuid,
  p_station_code text,
  p_display_label text,
  p_permissions jsonb,
  p_granted_by uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_station text := lower(trim(coalesce(p_station_code, 'waiter')));
begin
  if p_restaurant_id is null or p_staff_user_id is null then raise exception 'Staff identity is required'; end if;
  if v_station not in (
    'waiter', 'cashier', 'manager', 'kitchen', 'grill', 'drinks',
    'fast_food', 'starters', 'salads', 'packing', 'dispatch'
  ) then raise exception 'Invalid station'; end if;
  if p_restaurant_id = p_staff_user_id then raise exception 'Owner cannot be added as staff'; end if;

  update public.restaurant_staff_memberships m
  set active = false, updated_at = now()
  where m.restaurant_user_id = p_restaurant_id
    and m.member_user_id = p_staff_user_id
    and m.station <> v_station
    and m.active = true;

  insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
  values (p_staff_user_id, 'restaurant_employee', 'restaurant', p_restaurant_id, 'active', now())
  on conflict on constraint user_roles_pkey
  do update set status = 'active', updated_at = now();

  insert into public.restaurant_staff_memberships (
    restaurant_user_id, member_user_id, station, display_name,
    permissions, active, granted_by_user_id, updated_at
  ) values (
    p_restaurant_id, p_staff_user_id, v_station,
    left(coalesce(nullif(trim(p_display_label), ''), 'Personal'), 100),
    coalesce(p_permissions, '{}'::jsonb), true, p_granted_by, now()
  )
  on conflict on constraint restaurant_staff_memberships_pkey
  do update set
    display_name = excluded.display_name,
    permissions = excluded.permissions,
    active = true,
    granted_by_user_id = excluded.granted_by_user_id,
    updated_at = now();
end;
$$;

create or replace function public.invite_current_restaurant_staff(
  p_email text,
  p_station text default 'waiter',
  p_display_name text default ''
)
returns table (
  member_user_id uuid,
  member_email text,
  station text,
  display_name text,
  active boolean,
  pending boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_owner_id uuid := auth.uid();
  v_member_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_station text := lower(trim(coalesce(p_station, 'waiter')));
  v_display_name text := left(trim(coalesce(p_display_name, '')), 100);
  v_permissions jsonb;
begin
  if v_owner_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = v_owner_id and rp.active = true and rp.deleted_at is null
  ) then raise exception 'Restaurant owner profile is missing'; end if;
  if v_station not in (
    'waiter', 'cashier', 'manager', 'kitchen', 'grill', 'drinks',
    'fast_food', 'starters', 'salads', 'packing', 'dispatch'
  ) then raise exception 'Invalid station'; end if;
  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Employee email is invalid';
  end if;

  v_permissions := case
    when v_station in ('waiter', 'cashier', 'manager') then '{"create_orders":true}'::jsonb
    else '{}'::jsonb
  end;
  select au.id into v_member_id from auth.users au where lower(trim(au.email)) = v_email limit 1;
  if v_member_id = v_owner_id then raise exception 'Owner cannot be added as staff'; end if;

  if v_member_id is null then
    insert into public.restaurant_staff_invitations (
      restaurant_user_id, email, station, display_name, permissions,
      status, invited_by_user_id, claimed_by_user_id, claimed_at, updated_at
    ) values (
      v_owner_id, v_email, v_station,
      coalesce(nullif(v_display_name, ''), split_part(v_email, '@', 1)),
      v_permissions, 'pending', v_owner_id, null, null, now()
    )
    on conflict on constraint restaurant_staff_invitations_pkey
    do update set station = excluded.station, display_name = excluded.display_name,
      permissions = excluded.permissions, status = 'pending',
      invited_by_user_id = v_owner_id, claimed_by_user_id = null,
      claimed_at = null, updated_at = now();
    return query select null::uuid, v_email, v_station,
      coalesce(nullif(v_display_name, ''), split_part(v_email, '@', 1)), false, true;
    return;
  end if;

  perform public.activate_restaurant_staff_membership_internal(
    v_owner_id, v_member_id, v_station,
    coalesce(nullif(v_display_name, ''), split_part(v_email, '@', 1)),
    v_permissions, v_owner_id
  );
  insert into public.restaurant_staff_invitations (
    restaurant_user_id, email, station, display_name, permissions, status,
    invited_by_user_id, claimed_by_user_id, claimed_at, updated_at
  ) values (
    v_owner_id, v_email, v_station,
    coalesce(nullif(v_display_name, ''), split_part(v_email, '@', 1)),
    v_permissions, 'claimed', v_owner_id, v_member_id, now(), now()
  )
  on conflict on constraint restaurant_staff_invitations_pkey
  do update set station = excluded.station, display_name = excluded.display_name,
    permissions = excluded.permissions, status = 'claimed',
    invited_by_user_id = v_owner_id, claimed_by_user_id = v_member_id,
    claimed_at = now(), updated_at = now();

  return query
  select m.member_user_id, v_email, m.station, m.display_name, m.active, false
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = v_owner_id
    and m.member_user_id = v_member_id and m.station = v_station and m.active = true;
end;
$$;

create or replace function public.list_my_station_orders(p_restaurant_user_id uuid)
returns table (
  order_id uuid,
  order_status text,
  station_status text,
  table_label text,
  customer_name text,
  order_type text,
  items jsonb,
  notes text,
  source text,
  server_name text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member_id uuid := auth.uid();
  v_station text;
begin
  if v_member_id is null then raise exception 'Not authenticated'; end if;
  select m.station into v_station
  from public.restaurant_staff_memberships m
  join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = v_member_id and m.active = true
    and rp.active = true and rp.deleted_at is null
  order by m.updated_at desc limit 1;
  if v_station is null then raise exception 'Station is not authorized'; end if;

  if v_station in ('kitchen', 'grill', 'drinks', 'fast_food', 'starters', 'salads', 'packing') then
    return query
    select co.id, co.status, task.status, co.table_label, co.customer_name, co.order_type,
      task.items, upper(left(coalesce(co.order_json->>'notes', ''), 1000)),
      co.source, co.server_name, co.created_at, greatest(co.updated_at, task.updated_at)
    from public.order_station_tasks task
    join public.customer_orders co on co.id = task.customer_order_id
    where task.restaurant_user_id = p_restaurant_user_id
      and task.station = v_station
      and task.status not in ('blocked', 'packed', 'cancelled')
      and co.status in ('accepted', 'sent')
      and co.created_at >= now() - interval '36 hours'
    order by co.created_at asc limit 100;
    return;
  end if;

  return query
  select co.id, co.status, co.station_status, co.table_label, co.customer_name, co.order_type,
    coalesce(co.order_json->'items', '[]'::jsonb), upper(left(coalesce(co.order_json->>'notes', ''), 1000)),
    co.source, co.server_name, co.created_at, co.updated_at
  from public.customer_orders co
  where co.user_id = p_restaurant_user_id and co.status in ('accepted', 'sent')
    and co.station_status not in ('completed', 'cancelled')
    and co.created_at >= now() - interval '36 hours'
  order by co.created_at asc limit 100;
end;
$$;

create or replace function public.publish_current_restaurant_order_to_stations(
  p_restaurant_order_id uuid,
  p_customer_order_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_customer_order_id uuid;
  v_items jsonb;
begin
  if v_owner_id is null then raise exception 'Not authenticated'; end if;
  select o.* into v_order from public.orders o
  where o.id = p_restaurant_order_id and o.user_id = v_owner_id;
  if not found then raise exception 'Restaurant order was not found'; end if;
  v_items := coalesce(v_order.order_json->'items', '[]'::jsonb);

  if p_customer_order_id is not null then
    update public.customer_orders co
    set restaurant_order_id = v_order.id,
        status = case when co.status = 'pending' then 'accepted' else co.status end,
        station_status = case when co.station_status in ('cancelled', 'completed') then co.station_status else 'received' end,
        order_json = co.order_json || jsonb_build_object(
          'items', v_items,
          'serverName', coalesce(nullif(v_order.order_json->>'server', ''), co.server_name, 'Caja')
        ),
        updated_at = now()
    where co.id = p_customer_order_id and co.user_id = v_owner_id
    returning co.id into v_customer_order_id;
    if v_customer_order_id is null then raise exception 'Customer order does not belong to this restaurant'; end if;
  else
    select co.id into v_customer_order_id from public.customer_orders co
    where co.user_id = v_owner_id and co.restaurant_order_id = v_order.id limit 1;
    if v_customer_order_id is null then
      insert into public.customer_orders (
        id, user_id, customer_user_id, status, table_label, customer_name,
        order_type, order_json, total, restaurant_order_id, source,
        created_by_user_id, server_name, station_status, created_at, updated_at
      ) values (
        v_order.id, v_owner_id, null, 'accepted',
        left(coalesce(v_order.order_json->>'customer', ''), 160), '',
        coalesce(nullif(v_order.order_json->>'type', ''), 'Comer en el punto'),
        v_order.order_json || jsonb_build_object('items', v_items, 'source', 'pos'),
        v_order.total, v_order.id, 'pos', v_owner_id,
        left(coalesce(nullif(v_order.order_json->>'server', ''), 'Caja'), 100),
        'received', v_order.created_at, now()
      )
      on conflict (id) do update
      set order_json = excluded.order_json, total = excluded.total,
          restaurant_order_id = excluded.restaurant_order_id, updated_at = now()
      returning customer_orders.id into v_customer_order_id;
    end if;
  end if;

  perform public.rc_ordera_sync_order_station_tasks(v_customer_order_id);
  return v_customer_order_id;
end;
$$;

create or replace function public.update_my_station_order(
  p_restaurant_user_id uuid,
  p_order_id uuid,
  p_next_station_status text
)
returns table (order_id uuid, order_status text, station_status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member_id uuid := auth.uid();
  v_station text;
  v_next text := lower(trim(coalesce(p_next_station_status, '')));
  v_current text;
  v_order_status text;
begin
  if v_member_id is null then raise exception 'Not authenticated'; end if;
  select m.station into v_station
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = v_member_id and m.active = true
  order by m.updated_at desc limit 1;
  if v_station is null then raise exception 'Station is not authorized'; end if;

  select co.status into v_order_status from public.customer_orders co
  where co.id = p_order_id and co.user_id = p_restaurant_user_id for update;
  if not found or v_order_status not in ('accepted', 'sent') then raise exception 'Order is not active'; end if;

  if v_station in ('kitchen', 'grill', 'drinks', 'fast_food', 'starters', 'salads', 'packing') then
    select task.status into v_current from public.order_station_tasks task
    where task.customer_order_id = p_order_id and task.station = v_station for update;
    if not found then raise exception 'Station task was not found'; end if;

    if v_station = 'packing' then
      if v_next <> 'packed' or v_current <> 'received' then raise exception 'Station transition is not allowed'; end if;
      update public.order_station_tasks set status = 'packed', completed_at = now(), updated_at = now()
      where customer_order_id = p_order_id and station = 'packing';
      update public.customer_orders set station_status = 'packed', updated_at = now() where id = p_order_id;
    else
      if not ((v_current = 'received' and v_next = 'preparing') or (v_current = 'preparing' and v_next = 'ready')) then
        raise exception 'Station transition is not allowed';
      end if;
      update public.order_station_tasks
      set status = v_next,
          started_at = case when v_next = 'preparing' then coalesce(started_at, now()) else started_at end,
          completed_at = case when v_next = 'ready' then now() else completed_at end,
          updated_at = now()
      where customer_order_id = p_order_id and station = v_station;

      if not exists (
        select 1 from public.order_station_tasks t
        where t.customer_order_id = p_order_id and t.station <> 'packing'
          and t.status not in ('ready', 'cancelled')
      ) then
        update public.order_station_tasks set status = 'received', updated_at = now()
        where customer_order_id = p_order_id and station = 'packing' and status = 'blocked';
        update public.customer_orders set station_status = 'ready', updated_at = now() where id = p_order_id;
      else
        update public.customer_orders set station_status = 'preparing', updated_at = now() where id = p_order_id;
      end if;
    end if;
  elsif v_station = 'dispatch' then
    if v_next = 'dispatched' then
      update public.customer_orders set station_status = 'dispatched', status = 'sent', updated_at = now()
      where id = p_order_id and station_status in ('ready', 'packed');
    elsif v_next = 'completed' then
      update public.customer_orders set station_status = 'completed', status = 'delivered', updated_at = now()
      where id = p_order_id and station_status = 'dispatched';
    else raise exception 'Station transition is not allowed'; end if;
    if not found then raise exception 'Station transition is not allowed'; end if;
  elsif v_station not in ('manager', 'cashier') then
    raise exception 'Station transition is not allowed';
  else
    if v_next not in ('received', 'preparing', 'ready', 'packed', 'dispatched', 'completed', 'cancelled') then
      raise exception 'Station transition is not allowed';
    end if;
    update public.customer_orders
    set station_status = v_next,
        status = case when v_next = 'dispatched' then 'sent'
          when v_next = 'completed' then 'delivered'
          when v_next = 'cancelled' then 'cancelled' else status end,
        updated_at = now()
    where id = p_order_id;
  end if;

  return query
  select co.id, co.status,
    case when v_station in ('kitchen', 'grill', 'drinks', 'fast_food', 'starters', 'salads', 'packing')
      then (select t.status from public.order_station_tasks t where t.customer_order_id = co.id and t.station = v_station)
      else co.station_status end,
    co.updated_at
  from public.customer_orders co where co.id = p_order_id;
end;
$$;

create or replace function public.clock_my_restaurant_shift(
  p_restaurant_user_id uuid,
  p_action text
)
returns table (
  entry_id uuid,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  is_open boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member_id uuid := auth.uid();
  v_station text;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_entry public.employee_time_entries%rowtype;
begin
  if v_member_id is null then raise exception 'Not authenticated'; end if;
  select m.station into v_station
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = v_member_id and m.active = true
  order by m.updated_at desc limit 1;
  if v_station is null then raise exception 'Station is not authorized'; end if;

  select e.* into v_entry from public.employee_time_entries e
  where e.restaurant_user_id = p_restaurant_user_id
    and e.member_user_id = v_member_id and e.clock_out_at is null
  order by e.clock_in_at desc limit 1 for update;

  if v_action = 'in' then
    if not found then
      insert into public.employee_time_entries (
        restaurant_user_id, member_user_id, membership_station, clock_in_source
      ) values (p_restaurant_user_id, v_member_id, v_station, 'employee_app')
      returning * into v_entry;
    end if;
  elsif v_action = 'out' then
    if not found then raise exception 'No open shift was found'; end if;
    update public.employee_time_entries e
    set clock_out_at = now(), clock_out_source = 'employee_app', updated_at = now()
    where e.id = v_entry.id returning * into v_entry;
  else
    raise exception 'Invalid shift action';
  end if;

  insert into public.platform_audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, restaurant_user_id, after_data
  ) values (
    v_member_id, 'restaurant_employee',
    case when v_action = 'in' then 'employee_clock_in' else 'employee_clock_out' end,
    'employee_time_entry', v_entry.id, p_restaurant_user_id,
    jsonb_build_object('station', v_station, 'clock_in_at', v_entry.clock_in_at, 'clock_out_at', v_entry.clock_out_at)
  );

  return query select v_entry.id, v_entry.clock_in_at, v_entry.clock_out_at, v_entry.clock_out_at is null;
end;
$$;

create or replace function public.get_my_restaurant_shift_status(p_restaurant_user_id uuid)
returns table (
  entry_id uuid,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  is_open boolean,
  worked_minutes bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member_id uuid := auth.uid();
begin
  if v_member_id is null or not exists (
    select 1 from public.restaurant_staff_memberships m
    where m.restaurant_user_id = p_restaurant_user_id
      and m.member_user_id = v_member_id and m.active = true
  ) then raise exception 'Station is not authorized'; end if;

  return query
  select e.id, e.clock_in_at, e.clock_out_at, e.clock_out_at is null,
    greatest(0, floor(extract(epoch from (coalesce(e.clock_out_at, now()) - e.clock_in_at)) / 60))::bigint
  from public.employee_time_entries e
  where e.restaurant_user_id = p_restaurant_user_id and e.member_user_id = v_member_id
  order by e.clock_in_at desc limit 1;
end;
$$;

create or replace function public.rc_ordera_waiter_daily_report(
  p_restaurant_user_id uuid,
  p_member_user_id uuid,
  p_business_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_timezone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_report jsonb;
begin
  select coalesce(nullif(trim(rp.timezone), ''),
    case upper(trim(coalesce(rp.country_code, ''))) when 'PL' then 'Europe/Warsaw' when 'CO' then 'America/Bogota' else 'UTC' end)
  into v_timezone from public.restaurant_profiles rp where rp.user_id = p_restaurant_user_id;
  if v_timezone is null then raise exception 'Restaurant was not found'; end if;
  v_start_at := p_business_date::timestamp at time zone v_timezone;
  v_end_at := (p_business_date + 1)::timestamp at time zone v_timezone;

  select jsonb_build_object(
    'business_date', p_business_date,
    'timezone', v_timezone,
    'order_count', count(*) filter (where co.status not in ('cancelled', 'rejected')),
    'cancelled_count', count(*) filter (where co.status in ('cancelled', 'rejected')),
    'sales_total', coalesce(round(sum(co.total) filter (where co.status not in ('cancelled', 'rejected')), 2), 0),
    'average_ticket', coalesce(round(avg(co.total) filter (where co.status not in ('cancelled', 'rejected')), 2), 0),
    'first_order_at', min(co.created_at),
    'last_order_at', max(co.created_at)
  ) into v_report
  from public.customer_orders co
  where co.user_id = p_restaurant_user_id
    and co.created_by_user_id = p_member_user_id
    and co.created_at >= v_start_at and co.created_at < v_end_at;
  return coalesce(v_report, '{}'::jsonb);
end;
$$;

create or replace function public.get_my_waiter_daily_report(
  p_restaurant_user_id uuid,
  p_business_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare v_member_id uuid := auth.uid();
begin
  if v_member_id is null or not exists (
    select 1 from public.restaurant_staff_memberships m
    where m.restaurant_user_id = p_restaurant_user_id
      and m.member_user_id = v_member_id and m.active = true
      and m.station in ('waiter', 'cashier', 'manager')
  ) then raise exception 'Waiter is not authorized'; end if;
  return public.rc_ordera_waiter_daily_report(p_restaurant_user_id, v_member_id, p_business_date);
end;
$$;

create or replace function public.close_my_waiter_day(
  p_restaurant_user_id uuid,
  p_business_date date default current_date
)
returns table (closure_id uuid, report_snapshot jsonb, closed_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member_id uuid := auth.uid();
  v_report jsonb;
begin
  if v_member_id is null or not exists (
    select 1 from public.restaurant_staff_memberships m
    where m.restaurant_user_id = p_restaurant_user_id
      and m.member_user_id = v_member_id and m.active = true
      and m.station in ('waiter', 'cashier', 'manager')
  ) then raise exception 'Waiter is not authorized'; end if;
  v_report := public.rc_ordera_waiter_daily_report(p_restaurant_user_id, v_member_id, p_business_date);
  return query
  insert into public.waiter_daily_closures (
    restaurant_user_id, member_user_id, business_date, report_snapshot, closed_at
  ) values (p_restaurant_user_id, v_member_id, p_business_date, v_report, now())
  on conflict (restaurant_user_id, member_user_id, business_date)
  do update set report_snapshot = excluded.report_snapshot, closed_at = now()
  returning waiter_daily_closures.id, waiter_daily_closures.report_snapshot, waiter_daily_closures.closed_at;
end;
$$;

create or replace function public.rc_ordera_waiter_monthly_report(
  p_restaurant_user_id uuid,
  p_member_user_id uuid,
  p_anchor_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_timezone text;
  v_period_start date := date_trunc('month', p_anchor_date)::date;
  v_period_end date := (date_trunc('month', p_anchor_date) + interval '1 month')::date;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_report jsonb;
begin
  select coalesce(nullif(trim(rp.timezone), ''),
    case upper(trim(coalesce(rp.country_code, ''))) when 'PL' then 'Europe/Warsaw' when 'CO' then 'America/Bogota' else 'UTC' end)
  into v_timezone from public.restaurant_profiles rp where rp.user_id = p_restaurant_user_id;
  if v_timezone is null then raise exception 'Restaurant was not found'; end if;
  v_start_at := v_period_start::timestamp at time zone v_timezone;
  v_end_at := v_period_end::timestamp at time zone v_timezone;

  select jsonb_build_object(
    'period_start', v_period_start,
    'period_end', v_period_end,
    'timezone', v_timezone,
    'order_count', count(*) filter (where co.status not in ('cancelled', 'rejected')),
    'cancelled_count', count(*) filter (where co.status in ('cancelled', 'rejected')),
    'sales_total', coalesce(round(sum(co.total) filter (where co.status not in ('cancelled', 'rejected')), 2), 0),
    'average_ticket', coalesce(round(avg(co.total) filter (where co.status not in ('cancelled', 'rejected')), 2), 0),
    'first_order_at', min(co.created_at),
    'last_order_at', max(co.created_at)
  ) into v_report
  from public.customer_orders co
  where co.user_id = p_restaurant_user_id
    and co.created_by_user_id = p_member_user_id
    and co.created_at >= v_start_at and co.created_at < v_end_at;
  return coalesce(v_report, '{}'::jsonb);
end;
$$;

create or replace function public.get_my_waiter_monthly_report(
  p_restaurant_user_id uuid,
  p_anchor_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare v_member_id uuid := auth.uid();
begin
  if v_member_id is null or not exists (
    select 1 from public.restaurant_staff_memberships m
    where m.restaurant_user_id = p_restaurant_user_id
      and m.member_user_id = v_member_id and m.active = true
      and m.station in ('waiter', 'cashier', 'manager')
  ) then raise exception 'Waiter is not authorized'; end if;
  return public.rc_ordera_waiter_monthly_report(p_restaurant_user_id, v_member_id, p_anchor_date);
end;
$$;

create or replace function public.close_my_waiter_month(
  p_restaurant_user_id uuid,
  p_anchor_date date default current_date
)
returns table (closure_id uuid, report_snapshot jsonb, closed_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member_id uuid := auth.uid();
  v_period_start date := date_trunc('month', p_anchor_date)::date;
  v_period_end date := (date_trunc('month', p_anchor_date) + interval '1 month')::date;
  v_report jsonb;
begin
  if v_member_id is null or not exists (
    select 1 from public.restaurant_staff_memberships m
    where m.restaurant_user_id = p_restaurant_user_id
      and m.member_user_id = v_member_id and m.active = true
      and m.station in ('waiter', 'cashier', 'manager')
  ) then raise exception 'Waiter is not authorized'; end if;
  v_report := public.rc_ordera_waiter_monthly_report(p_restaurant_user_id, v_member_id, p_anchor_date);
  return query
  insert into public.waiter_monthly_closures (
    restaurant_user_id, member_user_id, period_start, period_end, report_snapshot, closed_at
  ) values (p_restaurant_user_id, v_member_id, v_period_start, v_period_end, v_report, now())
  on conflict (restaurant_user_id, member_user_id, period_start)
  do update set report_snapshot = excluded.report_snapshot, period_end = excluded.period_end, closed_at = now()
  returning waiter_monthly_closures.id, waiter_monthly_closures.report_snapshot, waiter_monthly_closures.closed_at;
end;
$$;

create or replace function public.close_current_restaurant_period(
  p_period_type text,
  p_anchor_date date default current_date
)
returns table (closure_id uuid, report_snapshot jsonb, closed_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_period_type text := lower(trim(coalesce(p_period_type, '')));
  v_start_date date;
  v_end_date date;
  v_timezone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_report jsonb;
begin
  if v_owner_id is null or not exists (
    select 1 from public.restaurant_profiles rp where rp.user_id = v_owner_id and rp.deleted_at is null
  ) then raise exception 'Restaurant owner profile is missing'; end if;
  if v_period_type = 'day' then
    v_start_date := p_anchor_date; v_end_date := p_anchor_date + 1;
  elsif v_period_type = 'month' then
    v_start_date := date_trunc('month', p_anchor_date)::date;
    v_end_date := (v_start_date + interval '1 month')::date;
  elsif v_period_type = 'year' then
    v_start_date := date_trunc('year', p_anchor_date)::date;
    v_end_date := (v_start_date + interval '1 year')::date;
  else raise exception 'Invalid closure period'; end if;

  select coalesce(nullif(trim(rp.timezone), ''),
    case upper(trim(coalesce(rp.country_code, ''))) when 'PL' then 'Europe/Warsaw' when 'CO' then 'America/Bogota' else 'UTC' end)
  into v_timezone from public.restaurant_profiles rp where rp.user_id = v_owner_id;
  v_start_at := v_start_date::timestamp at time zone v_timezone;
  v_end_at := v_end_date::timestamp at time zone v_timezone;

  with period_orders as (
    select o.*,
      lower(trim(coalesce(o.order_json->>'status', 'saved'))) as report_status,
      coalesce(nullif(trim(o.order_json->>'paymentMethod'), ''), 'Sin especificar') as payment_method,
      coalesce(nullif(trim(o.order_json->>'type'), ''), 'Sin especificar') as order_type
    from public.orders o
    where o.user_id = v_owner_id
      and o.business_date >= v_start_date and o.business_date < v_end_date
  ), item_rows as (
    select po.id,
      coalesce(nullif(trim(item->>'product_name_snapshot'), ''), nullif(trim(item->>'name'), ''), 'Producto') as product_name,
      greatest(1, case when coalesce(item->>'quantity', item->>'qty', '') ~ '^[0-9]+$'
        then coalesce(item->>'quantity', item->>'qty')::integer else 1 end) as quantity,
      case when coalesce(item->>'total_snapshot', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (item->>'total_snapshot')::numeric
        else (case when coalesce(item->>'price', '') ~ '^[0-9]+([.][0-9]+)?$'
          then (item->>'price')::numeric else 0 end)
          * greatest(1, case when coalesce(item->>'quantity', item->>'qty', '') ~ '^[0-9]+$'
            then coalesce(item->>'quantity', item->>'qty')::integer else 1 end)
      end as line_total,
      public.rc_ordera_normalize_station(coalesce(item->>'station', item #>> '{options_snapshot,station}')) as station
    from period_orders po
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(po.order_json->'items') = 'array' then po.order_json->'items' else '[]'::jsonb end
    ) item
    where po.report_status not in ('cancelled', 'rejected')
  ), product_totals as (
    select product_name, sum(quantity)::bigint as quantity, round(sum(line_total), 2) as total
    from item_rows group by product_name
  ), station_totals as (
    select station, sum(quantity)::bigint as quantity, round(sum(line_total), 2) as total
    from item_rows group by station
  ), payment_totals as (
    select payment_method, count(*)::bigint as orders, round(sum(total), 2) as total
    from period_orders where report_status not in ('cancelled', 'rejected') group by payment_method
  ), order_type_totals as (
    select order_type, count(*)::bigint as orders, round(sum(total), 2) as total
    from period_orders where report_status not in ('cancelled', 'rejected') group by order_type
  )
  select jsonb_build_object(
    'period_type', v_period_type,
    'period_start', v_start_date,
    'period_end', v_end_date - 1,
    'timezone', v_timezone,
    'order_count', count(*) filter (where po.report_status not in ('cancelled', 'rejected')),
    'cancelled_count', count(*) filter (where po.report_status in ('cancelled', 'rejected')),
    'sales_total', coalesce(round(sum(po.total) filter (where po.report_status not in ('cancelled', 'rejected')), 2), 0),
    'average_ticket', coalesce(round(avg(po.total) filter (where po.report_status not in ('cancelled', 'rejected')), 2), 0),
    'products', coalesce((select jsonb_agg(to_jsonb(p) order by p.quantity desc, p.product_name) from product_totals p), '[]'::jsonb),
    'stations', coalesce((select jsonb_agg(to_jsonb(s) order by s.total desc, s.station) from station_totals s), '[]'::jsonb),
    'payment_methods', coalesce((select jsonb_agg(to_jsonb(pm) order by pm.total desc) from payment_totals pm), '[]'::jsonb),
    'order_types', coalesce((select jsonb_agg(to_jsonb(ot) order by ot.total desc) from order_type_totals ot), '[]'::jsonb)
  ) into v_report
  from period_orders po;

  return query
  insert into public.restaurant_period_closures (
    restaurant_user_id, period_type, period_start, period_end,
    report_snapshot, closed_by_user_id, closed_at
  ) values (v_owner_id, v_period_type, v_start_date, v_end_date - 1, v_report, v_owner_id, now())
  on conflict (restaurant_user_id, period_type, period_start)
  do update set report_snapshot = excluded.report_snapshot,
    period_end = excluded.period_end, closed_by_user_id = v_owner_id, closed_at = now()
  returning restaurant_period_closures.id, restaurant_period_closures.report_snapshot,
    restaurant_period_closures.closed_at;
end;
$$;

create or replace function public.get_current_restaurant_employee_hours(
  p_anchor_date date default current_date
)
returns table (
  member_user_id uuid,
  member_email text,
  display_name text,
  stations text,
  week_minutes bigint,
  month_minutes bigint,
  shift_open boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_timezone text;
  v_week_start timestamptz;
  v_month_start timestamptz;
  v_next_day timestamptz;
begin
  if v_owner_id is null or not exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = v_owner_id and rp.deleted_at is null
  ) then raise exception 'Restaurant owner profile is missing'; end if;

  select coalesce(nullif(trim(rp.timezone), ''),
    case upper(trim(coalesce(rp.country_code, '')))
      when 'PL' then 'Europe/Warsaw' when 'CO' then 'America/Bogota' else 'UTC' end)
  into v_timezone
  from public.restaurant_profiles rp where rp.user_id = v_owner_id;

  v_week_start := date_trunc('week', p_anchor_date::timestamp) at time zone v_timezone;
  v_month_start := date_trunc('month', p_anchor_date::timestamp) at time zone v_timezone;
  v_next_day := (p_anchor_date + 1)::timestamp at time zone v_timezone;

  return query
  with members as (
    select m.member_user_id,
      max(nullif(trim(m.display_name), '')) as display_name,
      string_agg(distinct m.station, ', ' order by m.station) as stations
    from public.restaurant_staff_memberships m
    where m.restaurant_user_id = v_owner_id and m.active = true
    group by m.member_user_id
  ), time_totals as (
    select e.member_user_id,
      floor(sum(extract(epoch from (
        least(coalesce(e.clock_out_at, now()), v_next_day)
        - greatest(e.clock_in_at, v_week_start)
      ))) filter (
        where e.clock_in_at < v_next_day and coalesce(e.clock_out_at, now()) > v_week_start
      ) / 60)::bigint as week_minutes,
      floor(sum(extract(epoch from (
        least(coalesce(e.clock_out_at, now()), v_next_day)
        - greatest(e.clock_in_at, v_month_start)
      ))) filter (
        where e.clock_in_at < v_next_day and coalesce(e.clock_out_at, now()) > v_month_start
      ) / 60)::bigint as month_minutes,
      bool_or(e.clock_out_at is null) as shift_open
    from public.employee_time_entries e
    where e.restaurant_user_id = v_owner_id
      and e.clock_in_at < v_next_day
      and coalesce(e.clock_out_at, now()) > least(v_week_start, v_month_start)
    group by e.member_user_id
  )
  select m.member_user_id, lower(coalesce(u.email, ''))::text,
    coalesce(m.display_name, split_part(coalesce(u.email, ''), '@', 1))::text,
    coalesce(m.stations, '')::text,
    greatest(coalesce(t.week_minutes, 0), 0)::bigint,
    greatest(coalesce(t.month_minutes, 0), 0)::bigint,
    coalesce(t.shift_open, false)
  from members m
  join auth.users u on u.id = m.member_user_id
  left join time_totals t on t.member_user_id = m.member_user_id
  order by coalesce(m.display_name, u.email);
end;
$$;

revoke all on table public.order_station_tasks from anon;
revoke all on table public.employee_time_entries from anon;
revoke all on table public.waiter_daily_closures from anon;
revoke all on table public.waiter_monthly_closures from anon;
revoke all on table public.restaurant_period_closures from anon;
grant select on public.order_station_tasks, public.employee_time_entries,
  public.waiter_daily_closures, public.waiter_monthly_closures,
  public.restaurant_period_closures to authenticated;

revoke all on function public.rc_ordera_normalize_station(text) from public, anon;
revoke all on function public.rc_ordera_order_item_station(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.rc_ordera_sync_order_station_tasks(uuid) from public, anon, authenticated;
revoke all on function public.activate_restaurant_staff_membership_internal(uuid, uuid, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.invite_current_restaurant_staff(text, text, text) from public, anon;
revoke all on function public.list_my_station_orders(uuid) from public, anon;
revoke all on function public.publish_current_restaurant_order_to_stations(uuid, uuid) from public, anon;
revoke all on function public.update_my_station_order(uuid, uuid, text) from public, anon;
revoke all on function public.clock_my_restaurant_shift(uuid, text) from public, anon;
revoke all on function public.get_my_restaurant_shift_status(uuid) from public, anon;
revoke all on function public.rc_ordera_waiter_daily_report(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.get_my_waiter_daily_report(uuid, date) from public, anon;
revoke all on function public.close_my_waiter_day(uuid, date) from public, anon;
revoke all on function public.rc_ordera_waiter_monthly_report(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.get_my_waiter_monthly_report(uuid, date) from public, anon;
revoke all on function public.close_my_waiter_month(uuid, date) from public, anon;
revoke all on function public.close_current_restaurant_period(text, date) from public, anon;
revoke all on function public.get_current_restaurant_employee_hours(date) from public, anon;

grant execute on function public.invite_current_restaurant_staff(text, text, text) to authenticated;
grant execute on function public.list_my_station_orders(uuid) to authenticated;
grant execute on function public.publish_current_restaurant_order_to_stations(uuid, uuid) to authenticated;
grant execute on function public.update_my_station_order(uuid, uuid, text) to authenticated;
grant execute on function public.clock_my_restaurant_shift(uuid, text) to authenticated;
grant execute on function public.get_my_restaurant_shift_status(uuid) to authenticated;
grant execute on function public.get_my_waiter_daily_report(uuid, date) to authenticated;
grant execute on function public.close_my_waiter_day(uuid, date) to authenticated;
grant execute on function public.get_my_waiter_monthly_report(uuid, date) to authenticated;
grant execute on function public.close_my_waiter_month(uuid, date) to authenticated;
grant execute on function public.close_current_restaurant_period(text, date) to authenticated;
grant execute on function public.get_current_restaurant_employee_hours(date) to authenticated;

do $verify$
begin
  if to_regclass('public.waiter_monthly_closures') is null
     or to_regprocedure('public.get_my_waiter_monthly_report(uuid,date)') is null
     or to_regprocedure('public.close_my_waiter_month(uuid,date)') is null then
    raise exception 'V85.02 could not complete the waiter monthly close contract';
  end if;
end;
$verify$;

commit;

notify pgrst, 'reload schema';
