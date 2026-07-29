-- RC ORDERA v66
-- Reparacion incremental del nucleo de nube del restaurante.
-- No borra pedidos, menus, usuarios ni configuraciones.
-- Se puede ejecutar nuevamente sin duplicar datos.

begin;

create extension if not exists pgcrypto;

create table if not exists public.restaurant_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default '',
  logo_url text not null default '',
  public_address text not null default '',
  phone text not null default '',
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  menu jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_number integer not null,
  business_date date not null,
  order_json jsonb not null,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_date date not null,
  next_ticket integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, business_date)
);

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  public_token text not null default encode(gen_random_bytes(16), 'hex'),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'pending',
  table_label text not null default '',
  customer_name text not null default '',
  order_type text not null default 'Comer en el punto',
  order_json jsonb not null default '{}'::jsonb,
  total numeric(12, 2) not null default 0,
  restaurant_order_id uuid null,
  assigned_courier_user_id uuid null references auth.users(id) on delete set null,
  courier_assignment_status text not null default 'unassigned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_orders
  add column if not exists assigned_courier_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists courier_assignment_status text not null default 'unassigned';

update public.customer_orders
set courier_assignment_status = 'unassigned'
where courier_assignment_status is null
   or courier_assignment_status not in (
     'unassigned',
     'offered',
     'accepted',
     'rejected',
     'arrived_restaurant',
     'picked_up',
     'arrived_customer',
     'delivered',
     'cancelled',
     'expired',
     'no_courier'
   );

alter table public.customer_orders
drop constraint if exists customer_orders_courier_assignment_status_check;

alter table public.customer_orders
add constraint customer_orders_courier_assignment_status_check
check (
  courier_assignment_status in (
    'unassigned',
    'offered',
    'accepted',
    'rejected',
    'arrived_restaurant',
    'picked_up',
    'arrived_customer',
    'delivered',
    'cancelled',
    'expired',
    'no_courier'
  )
);

alter table public.app_settings enable row level security;
alter table public.restaurant_profiles enable row level security;
alter table public.orders enable row level security;
alter table public.ticket_counters enable row level security;
alter table public.customer_orders enable row level security;

drop policy if exists "Users manage own app settings" on public.app_settings;
create policy "Users manage own app settings"
on public.app_settings
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Public read app menu settings" on public.app_settings;
create policy "Public read app menu settings"
on public.app_settings
for select
to anon, authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.restaurant_profiles rp
    where rp.user_id = app_settings.user_id
      and rp.active = true
  )
);

drop policy if exists "Public read active restaurant profiles" on public.restaurant_profiles;
create policy "Public read active restaurant profiles"
on public.restaurant_profiles
for select
to anon, authenticated
using (active = true or auth.uid() = user_id);

drop policy if exists "Restaurants manage own public profile" on public.restaurant_profiles;
create policy "Restaurants manage own public profile"
on public.restaurant_profiles
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own orders" on public.orders;
create policy "Users manage own orders"
on public.orders
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own ticket counters" on public.ticket_counters;
create policy "Users manage own ticket counters"
on public.ticket_counters
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own customer orders" on public.customer_orders;
create policy "Users manage own customer orders"
on public.customer_orders
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Authenticated customers read own customer orders" on public.customer_orders;
create policy "Authenticated customers read own customer orders"
on public.customer_orders
for select
to authenticated
using (auth.uid() = customer_user_id);

create or replace function public.claim_next_ticket(p_business_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.ticket_counters (user_id, business_date, next_ticket)
  values (v_user_id, p_business_date, 1)
  on conflict (user_id, business_date) do nothing;

  select next_ticket
    into v_ticket
  from public.ticket_counters
  where user_id = v_user_id
    and business_date = p_business_date
  for update;

  update public.ticket_counters
  set next_ticket = v_ticket + 1,
      updated_at = now()
  where user_id = v_user_id
    and business_date = p_business_date;

  return v_ticket;
end;
$$;

create or replace function public.set_next_ticket(p_business_date date, p_next_ticket integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_next_ticket < 1 then
    raise exception 'Ticket must be greater than zero';
  end if;

  insert into public.ticket_counters (user_id, business_date, next_ticket)
  values (v_user_id, p_business_date, p_next_ticket)
  on conflict (user_id, business_date)
  do update set next_ticket = excluded.next_ticket,
                updated_at = now();
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.app_settings to anon, authenticated;
grant insert, update, delete on public.app_settings to authenticated;
grant select on public.restaurant_profiles to anon, authenticated;
grant insert, update, delete on public.restaurant_profiles to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.ticket_counters to authenticated;
grant select, insert, update, delete on public.customer_orders to authenticated;
grant execute on function public.claim_next_ticket(date) to authenticated;
grant execute on function public.set_next_ticket(date, integer) to authenticated;

create index if not exists customer_orders_restaurant_status_created_idx
on public.customer_orders (user_id, status, created_at desc);

alter table public.app_settings replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;

-- Debe mostrar seis filas con estado OK.
select 'app_settings' as comprobacion,
       case when to_regclass('public.app_settings') is not null then 'OK' else 'FALTA' end as estado
union all
select 'restaurant_profiles',
       case when to_regclass('public.restaurant_profiles') is not null then 'OK' else 'FALTA' end
union all
select 'orders',
       case when to_regclass('public.orders') is not null then 'OK' else 'FALTA' end
union all
select 'ticket_counters',
       case when to_regclass('public.ticket_counters') is not null then 'OK' else 'FALTA' end
union all
select 'customer_orders',
       case when to_regclass('public.customer_orders') is not null then 'OK' else 'FALTA' end
union all
select 'columnas_colaborador',
       case when (
         select count(*) = 2
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'customer_orders'
           and column_name in ('assigned_courier_user_id', 'courier_assignment_status')
       ) then 'OK' else 'FALTA' end;
