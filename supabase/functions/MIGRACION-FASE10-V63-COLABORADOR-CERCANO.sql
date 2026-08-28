-- Fase 10 / v63
-- Colaborador mas cercano: disponibilidad, ubicacion en vivo y ofertas de entrega.
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.courier_live_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available boolean not null default false,
  lat numeric(10, 7) not null,
  lng numeric(10, 7) not null,
  accuracy_m integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders(id) on delete cascade,
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  courier_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'offered' check (
    status in (
      'offered',
      'accepted',
      'rejected',
      'arrived_restaurant',
      'picked_up',
      'arrived_customer',
      'delivered',
      'cancelled',
      'expired'
    )
  ),
  distance_km numeric(10, 3) not null default 0,
  pickup_lat numeric(10, 7) null,
  pickup_lng numeric(10, 7) null,
  courier_lat numeric(10, 7) null,
  courier_lng numeric(10, 7) null,
  offer_expires_at timestamptz not null default (now() + interval '3 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_order_id, courier_user_id)
);

alter table public.customer_orders
  add column if not exists assigned_courier_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists courier_assignment_status text not null default 'unassigned';

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

alter table public.courier_live_locations enable row level security;
alter table public.delivery_assignments enable row level security;

drop policy if exists "Couriers manage own live location" on public.courier_live_locations;
create policy "Couriers manage own live location"
on public.courier_live_locations
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Restaurants read own delivery assignments" on public.delivery_assignments;
create policy "Restaurants read own delivery assignments"
on public.delivery_assignments
for select
using (auth.uid() = restaurant_user_id);

drop policy if exists "Couriers read offered delivery assignments" on public.delivery_assignments;
create policy "Couriers read offered delivery assignments"
on public.delivery_assignments
for select
using (auth.uid() = courier_user_id);

drop policy if exists "Restaurants update own delivery assignments" on public.delivery_assignments;
create policy "Restaurants update own delivery assignments"
on public.delivery_assignments
for update
using (auth.uid() = restaurant_user_id)
with check (auth.uid() = restaurant_user_id);

drop policy if exists "Couriers update own delivery assignments" on public.delivery_assignments;
create policy "Couriers update own delivery assignments"
on public.delivery_assignments
for update
using (auth.uid() = courier_user_id)
with check (auth.uid() = courier_user_id);

create or replace function public.distance_km(
  p_lat1 numeric,
  p_lng1 numeric,
  p_lat2 numeric,
  p_lng2 numeric
)
returns numeric
language sql
immutable
as $$
  select round(
    (
      6371 * acos(
        least(
          1,
          greatest(
            -1,
            cos(radians(p_lat1::double precision)) *
            cos(radians(p_lat2::double precision)) *
            cos(radians(p_lng2::double precision) - radians(p_lng1::double precision)) +
            sin(radians(p_lat1::double precision)) *
            sin(radians(p_lat2::double precision))
          )
        )
      )
    )::numeric,
    3
  );
$$;

create or replace function public.parse_lat_lng(p_value text)
returns table(lat numeric, lng numeric)
language sql
stable
as $$
  select
    (match[1])::numeric as lat,
    (match[2])::numeric as lng
  from regexp_matches(
    coalesce(p_value, ''),
    '^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$'
  ) as match
  where (match[1])::numeric between -90 and 90
    and (match[2])::numeric between -180 and 180
  limit 1;
$$;

create or replace function public.upsert_courier_live_location(
  p_available boolean,
  p_lat numeric,
  p_lng numeric,
  p_accuracy_m integer default 0
)
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

  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid location';
  end if;

  if not exists (
    select 1
    from public.courier_profiles cp
    where cp.user_id = v_user_id
      and cp.status = 'approved'
  ) then
    raise exception 'Courier profile is not approved';
  end if;

  insert into public.courier_live_locations (user_id, available, lat, lng, accuracy_m, updated_at)
  values (v_user_id, coalesce(p_available, false), p_lat, p_lng, greatest(coalesce(p_accuracy_m, 0), 0), now())
  on conflict (user_id)
  do update set
    available = excluded.available,
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy_m = excluded.accuracy_m,
    updated_at = now();
end;
$$;

create or replace function public.assign_nearest_courier(p_customer_order_id uuid)
returns table(
  assignment_id uuid,
  courier_user_id uuid,
  courier_name text,
  courier_phone text,
  distance_km numeric,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_user_id uuid := auth.uid();
  v_order public.customer_orders%rowtype;
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_existing public.delivery_assignments%rowtype;
  v_candidate record;
begin
  if v_restaurant_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_order
  from public.customer_orders co
  where co.id = p_customer_order_id
    and co.user_id = v_restaurant_user_id;

  if v_order.id is null then
    raise exception 'Order not found';
  end if;

  if coalesce(v_order.order_type, '') <> 'Domicilio' then
    raise exception 'Order is not delivery';
  end if;

  select pll.lat, pll.lng
    into v_pickup_lat, v_pickup_lng
  from public.app_settings s
  cross join lateral public.parse_lat_lng(s.settings->>'restaurantAddress') pll
  where s.user_id = v_restaurant_user_id
  limit 1;

  if v_pickup_lat is null or v_pickup_lng is null then
    update public.customer_orders
    set courier_assignment_status = 'no_courier',
        updated_at = now()
    where id = v_order.id;
    raise exception 'Restaurant location is missing';
  end if;

  select *
    into v_existing
  from public.delivery_assignments da
  where da.customer_order_id = v_order.id
    and da.status in ('offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
  order by da.created_at desc
  limit 1;

  if v_existing.id is not null then
    return query
    select
      v_existing.id,
      v_existing.courier_user_id,
      trim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, ''))::text,
      cp.phone,
      v_existing.distance_km,
      v_existing.status
    from public.courier_profiles cp
    where cp.user_id = v_existing.courier_user_id;
    return;
  end if;

  select
    cl.user_id,
    cl.lat,
    cl.lng,
    public.distance_km(v_pickup_lat, v_pickup_lng, cl.lat, cl.lng) as km,
    cp.first_name,
    cp.last_name,
    cp.phone
    into v_candidate
  from public.courier_live_locations cl
  join public.courier_profiles cp on cp.user_id = cl.user_id
  where cl.available = true
    and cl.updated_at > now() - interval '20 minutes'
    and cp.status = 'approved'
    and not exists (
      select 1
      from public.delivery_assignments active
      where active.courier_user_id = cl.user_id
        and active.status in ('offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
        and active.updated_at > now() - interval '4 hours'
    )
  order by km asc
  limit 1;

  if v_candidate.user_id is null then
    update public.customer_orders
    set courier_assignment_status = 'no_courier',
        updated_at = now()
    where id = v_order.id;
    return;
  end if;

  return query
  with inserted as (
    insert into public.delivery_assignments (
      customer_order_id,
      restaurant_user_id,
      courier_user_id,
      status,
      distance_km,
      pickup_lat,
      pickup_lng,
      courier_lat,
      courier_lng,
      updated_at
    )
    values (
      v_order.id,
      v_restaurant_user_id,
      v_candidate.user_id,
      'offered',
      v_candidate.km,
      v_pickup_lat,
      v_pickup_lng,
      v_candidate.lat,
      v_candidate.lng,
      now()
    )
    on conflict (customer_order_id, courier_user_id)
    do update set
      status = 'offered',
      distance_km = excluded.distance_km,
      pickup_lat = excluded.pickup_lat,
      pickup_lng = excluded.pickup_lng,
      courier_lat = excluded.courier_lat,
      courier_lng = excluded.courier_lng,
      offer_expires_at = now() + interval '3 minutes',
      updated_at = now()
    returning *
  ), updated_order as (
    update public.customer_orders co
    set assigned_courier_user_id = v_candidate.user_id,
        courier_assignment_status = 'offered',
        updated_at = now()
    where co.id = v_order.id
    returning co.id
  )
  select
    inserted.id,
    inserted.courier_user_id,
    trim(coalesce(v_candidate.first_name, '') || ' ' || coalesce(v_candidate.last_name, ''))::text,
    coalesce(v_candidate.phone, '')::text,
    inserted.distance_km,
    inserted.status
  from inserted;
end;
$$;

create or replace function public.get_courier_delivery_offers()
returns table(
  assignment_id uuid,
  customer_order_id uuid,
  restaurant_user_id uuid,
  restaurant_name text,
  status text,
  order_status text,
  order_type text,
  customer_name text,
  table_label text,
  order_json jsonb,
  total numeric,
  distance_km numeric,
  pickup_lat numeric,
  pickup_lng numeric,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    da.id as assignment_id,
    co.id as customer_order_id,
    da.restaurant_user_id,
    coalesce(nullif(rp.business_name, ''), nullif(s.settings->>'businessName', ''), 'Restaurante') as restaurant_name,
    da.status,
    co.status as order_status,
    co.order_type,
    co.customer_name,
    co.table_label,
    co.order_json,
    co.total,
    da.distance_km,
    da.pickup_lat,
    da.pickup_lng,
    da.created_at,
    da.updated_at
  from public.delivery_assignments da
  join public.customer_orders co on co.id = da.customer_order_id
  left join public.restaurant_profiles rp on rp.user_id = da.restaurant_user_id
  left join public.app_settings s on s.user_id = da.restaurant_user_id
  where da.courier_user_id = auth.uid()
    and da.status in ('offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
  order by da.created_at asc;
$$;

create or replace function public.update_delivery_assignment_status(
  p_assignment_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_assignment public.delivery_assignments%rowtype;
  v_customer_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_status not in ('accepted', 'rejected', 'arrived_restaurant', 'picked_up', 'arrived_customer', 'delivered', 'cancelled') then
    raise exception 'Invalid assignment status';
  end if;

  select *
    into v_assignment
  from public.delivery_assignments da
  where da.id = p_assignment_id
    and (da.courier_user_id = v_user_id or da.restaurant_user_id = v_user_id);

  if v_assignment.id is null then
    raise exception 'Assignment not found';
  end if;

  if v_user_id = v_assignment.courier_user_id and v_assignment.status = 'offered' and v_status not in ('accepted', 'rejected') then
    raise exception 'Accept or reject first';
  end if;

  update public.delivery_assignments
  set status = v_status,
      updated_at = now()
  where id = v_assignment.id;

  v_customer_status := case
    when v_status = 'accepted' then 'accepted'
    when v_status = 'picked_up' then 'sent'
    when v_status = 'delivered' then 'delivered'
    else null
  end;

  update public.customer_orders
  set courier_assignment_status = v_status,
      status = coalesce(v_customer_status, status),
      updated_at = now()
  where id = v_assignment.customer_order_id;

  if v_status in ('rejected', 'cancelled', 'delivered') then
    update public.courier_live_locations
    set available = case when v_status = 'delivered' then true else available end,
        updated_at = now()
    where user_id = v_assignment.courier_user_id;
  elsif v_status = 'accepted' then
    update public.courier_live_locations
    set available = false,
        updated_at = now()
    where user_id = v_assignment.courier_user_id;
  end if;
end;
$$;

grant select, insert, update on public.courier_live_locations to authenticated;
grant select, insert, update on public.delivery_assignments to authenticated;
grant execute on function public.distance_km(numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.parse_lat_lng(text) to authenticated;
grant execute on function public.upsert_courier_live_location(boolean, numeric, numeric, integer) to authenticated;
grant execute on function public.assign_nearest_courier(uuid) to authenticated;
grant execute on function public.get_courier_delivery_offers() to authenticated;
grant execute on function public.update_delivery_assignment_status(uuid, text) to authenticated;

