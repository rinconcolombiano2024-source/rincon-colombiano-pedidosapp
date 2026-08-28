-- RC ORDERA V84.1
-- Estabilizacion final incremental: disponibilidad persistente, seguimiento autorizado,
-- Realtime y contrato seguro de notificaciones de entrega.
-- Ejecutar una sola vez despues de V82, V83 y V84. Es idempotente y no borra datos.

begin;

do $preflight$
begin
  if to_regclass('public.customer_orders') is null
     or to_regclass('public.orders') is null
     or to_regclass('public.courier_profiles') is null
     or to_regclass('public.courier_live_locations') is null
     or to_regclass('public.delivery_assignments') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.order_status_history') is null
     or to_regprocedure('public.rc_ordera_is_platform_admin(uuid)') is null
     or to_regprocedure('public.rc_ordera_can_manage_restaurant(uuid,text)') is null
     or to_regprocedure('public.rc_ordera_offer_next_courier(uuid,uuid)') is null then
    raise exception 'Falta el nucleo V82/V83/V84 de RC ORDERA. No se aplico ningun cambio V84.1.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_orders'
      and column_name = 'canonical_status'
  ) then
    raise exception 'Falta customer_orders.canonical_status. Ejecuta V82 antes de V84.1.';
  end if;
end;
$preflight$;

alter table public.courier_profiles
  add column if not exists country_code text not null default '',
  add column if not exists region text not null default '';

alter table public.courier_live_locations
  add column if not exists country_code text not null default '',
  add column if not exists city text not null default '',
  add column if not exists region text not null default '',
  add column if not exists available_since timestamptz null,
  add column if not exists last_location_at timestamptz null;

update public.courier_live_locations cl
set available_since = case
      when cl.available then coalesce(cl.available_since, cl.updated_at)
      else null
    end,
    last_location_at = coalesce(cl.last_location_at, cl.updated_at)
where (cl.available and cl.available_since is null)
   or cl.last_location_at is null;

create index if not exists courier_live_locations_v841_dispatch_idx
  on public.courier_live_locations (available, country_code, updated_at desc)
  where available = true;

do $active_assignment_preflight$
begin
  if exists (
    select 1
    from public.delivery_assignments da
    where da.status in (
      'offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer'
    )
    group by da.customer_order_id
    having count(*) > 1
  ) then
    raise exception 'Hay pedidos con mas de una asignacion activa. Corrigelos manualmente antes de crear el indice V84.1.';
  end if;
end;
$active_assignment_preflight$;

create unique index if not exists delivery_assignments_one_active_order_v841_idx
  on public.delivery_assignments (customer_order_id)
  where status in (
    'offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer'
  );

-- La disponibilidad solo cambia mediante esta accion explicita o por suspension
-- administrativa. Un cambio de pedido o una escritura GPS no la modifica.
create or replace function public.set_courier_availability(p_available boolean)
returns table(available boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Not authenticated';
  end if;

  if coalesce(p_available, false) then
    if not exists (
      select 1
      from public.courier_profiles cp
      join public.user_roles ur
        on ur.user_id = cp.user_id
       and ur.role = 'platform_courier'
       and ur.scope_type = 'platform'
       and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
       and ur.status = 'active'
      where cp.user_id = v_user_id
        and cp.status = 'approved'
    ) then
      raise exception using errcode = '42501', message = 'Courier profile is not approved';
    end if;

    update public.courier_live_locations cl
    set available = true,
        available_since = coalesce(cl.available_since, now()),
        updated_at = now()
    where cl.user_id = v_user_id
      and cl.lat between -90 and 90
      and cl.lng between -180 and 180;

    if not found then
      raise exception 'Share a valid location before going online';
    end if;
  else
    update public.courier_live_locations cl
    set available = false,
        available_since = null,
        updated_at = now()
    where cl.user_id = v_user_id;
  end if;

  return query
  select coalesce(cl.available, false), coalesce(cl.updated_at, now())
  from (select 1) seed
  left join public.courier_live_locations cl
    on cl.user_id = v_user_id;
end;
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
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_country_code text;
  v_city text;
  v_region text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Not authenticated';
  end if;
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid location';
  end if;

  select
    upper(trim(coalesce(cp.country_code, ''))),
    trim(coalesce(cp.city, '')),
    trim(coalesce(cp.region, ''))
  into v_country_code, v_city, v_region
  from public.courier_profiles cp
  join public.user_roles ur
    on ur.user_id = cp.user_id
   and ur.role = 'platform_courier'
   and ur.scope_type = 'platform'
   and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
   and ur.status = 'active'
  where cp.user_id = v_user_id
    and cp.status = 'approved';

  if not found then
    raise exception using errcode = '42501', message = 'Courier profile is not approved';
  end if;

  insert into public.courier_live_locations (
    user_id, available, lat, lng, accuracy_m, country_code, city, region,
    available_since, last_location_at, updated_at
  ) values (
    v_user_id, coalesce(p_available, false), p_lat, p_lng,
    greatest(coalesce(p_accuracy_m, 0), 0), v_country_code, v_city, v_region,
    case when coalesce(p_available, false) then now() else null end,
    now(), now()
  )
  on conflict on constraint courier_live_locations_pkey
  do update set
    -- Un pulso GPS con false no desconecta. Solo set_courier_availability(false)
    -- o una suspension administrativa puede hacerlo.
    available = case
      when excluded.available is true then true
      else public.courier_live_locations.available
    end,
    available_since = case
      when excluded.available is true then coalesce(public.courier_live_locations.available_since, now())
      else public.courier_live_locations.available_since
    end,
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy_m = excluded.accuracy_m,
    country_code = excluded.country_code,
    city = excluded.city,
    region = excluded.region,
    last_location_at = now(),
    updated_at = now();
end;
$$;

create or replace function public.get_customer_order_tracking(
  p_order_id uuid,
  p_public_token text
)
returns table(
  customer_order_id uuid,
  status text,
  canonical_status text,
  updated_at timestamptz,
  restaurant_order_id uuid,
  ticket_number integer,
  courier_assignment_status text,
  assignment_id uuid,
  courier_user_id uuid,
  courier_name text,
  courier_lat numeric,
  courier_lng numeric,
  courier_location_updated_at timestamptz,
  estimated_pickup_at timestamptz,
  estimated_delivery_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_order_id is null or trim(coalesce(p_public_token, '')) = '' then
    return;
  end if;

  return query
  select
    co.id,
    co.status,
    co.canonical_status,
    co.updated_at,
    co.restaurant_order_id,
    o.ticket_number,
    coalesce(da.status, co.courier_assignment_status),
    da.id,
    da.courier_user_id,
    nullif(trim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, '')), ''),
    case
      when da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
        and co.canonical_status not in ('delivered', 'cancelled', 'rejected', 'failed', 'refunded')
      then cl.lat
      else null
    end,
    case
      when da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
        and co.canonical_status not in ('delivered', 'cancelled', 'rejected', 'failed', 'refunded')
      then cl.lng
      else null
    end,
    case
      when da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
        and co.canonical_status not in ('delivered', 'cancelled', 'rejected', 'failed', 'refunded')
      then coalesce(cl.last_location_at, cl.updated_at)
      else null
    end,
    coalesce(da.estimated_pickup_at, co.estimated_pickup_at),
    coalesce(da.estimated_delivery_at, co.estimated_delivery_at)
  from public.customer_orders co
  left join public.orders o
    on o.id = co.restaurant_order_id
  left join lateral (
    select candidate.*
    from public.delivery_assignments candidate
    where candidate.customer_order_id = co.id
    order by
      case when candidate.status in ('offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer') then 0 else 1 end,
      candidate.updated_at desc,
      candidate.id desc
    limit 1
  ) da on true
  left join public.courier_profiles cp
    on cp.user_id = da.courier_user_id
  left join public.courier_live_locations cl
    on cl.user_id = da.courier_user_id
  where co.id = p_order_id
    and co.public_token = trim(p_public_token)
    and (
      co.customer_user_id is null
      or auth.uid() is null
      or co.customer_user_id = auth.uid()
    )
  limit 1;
end;
$$;

create or replace function public.get_current_restaurant_delivery_tracking()
returns table(
  customer_order_id uuid,
  courier_assignment_status text,
  assignment_id uuid,
  courier_user_id uuid,
  courier_name text,
  courier_lat numeric,
  courier_lng numeric,
  courier_location_updated_at timestamptz,
  estimated_pickup_at timestamptz,
  estimated_delivery_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    co.id,
    coalesce(da.status, co.courier_assignment_status),
    da.id,
    da.courier_user_id,
    nullif(trim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, '')), ''),
    case when da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer') then cl.lat else null end,
    case when da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer') then cl.lng else null end,
    case when da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
      then coalesce(cl.last_location_at, cl.updated_at) else null end,
    coalesce(da.estimated_pickup_at, co.estimated_pickup_at),
    coalesce(da.estimated_delivery_at, co.estimated_delivery_at)
  from public.customer_orders co
  left join lateral (
    select candidate.*
    from public.delivery_assignments candidate
    where candidate.customer_order_id = co.id
    order by
      case when candidate.status in ('offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer') then 0 else 1 end,
      candidate.updated_at desc,
      candidate.id desc
    limit 1
  ) da on true
  left join public.courier_profiles cp
    on cp.user_id = da.courier_user_id
  left join public.courier_live_locations cl
    on cl.user_id = da.courier_user_id
  where auth.uid() is not null
    and public.rc_ordera_can_manage_restaurant(co.user_id, 'view_orders')
    and co.canonical_status not in ('delivered', 'cancelled', 'rejected', 'failed', 'refunded')
    and (
      lower(coalesce(co.order_type, '')) in ('domicilio', 'delivery')
      or lower(coalesce(co.order_json->>'type', '')) in ('domicilio', 'delivery')
      or co.assigned_courier_user_id is not null
    )
  order by co.created_at asc;
$$;

create or replace function public.get_my_courier_delivery_history()
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
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.courier_profiles cp
    where cp.user_id = v_user_id
      and cp.status = 'approved'
  ) then
    raise exception using errcode = '42501', message = 'Courier profile is not approved';
  end if;

  return query
  select
    da.id,
    da.customer_order_id,
    da.restaurant_user_id,
    coalesce(nullif(rp.business_name, ''), nullif(s.settings->>'businessName', ''), 'Restaurante')::text,
    da.status,
    co.status,
    co.order_type,
    co.customer_name,
    co.table_label,
    co.order_json,
    co.total,
    da.distance_km,
    da.created_at,
    da.updated_at
  from public.delivery_assignments da
  join public.customer_orders co
    on co.id = da.customer_order_id
  left join public.restaurant_profiles rp
    on rp.user_id = da.restaurant_user_id
  left join public.app_settings s
    on s.user_id = da.restaurant_user_id
  where da.courier_user_id = v_user_id
    and da.status in ('delivered', 'rejected', 'cancelled', 'expired')
  order by da.updated_at desc, da.id desc
  limit 200;
end;
$$;

drop policy if exists "Active order participants read courier live location"
  on public.courier_live_locations;

create policy "Active order participants read courier live location"
on public.courier_live_locations
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.delivery_assignments da
    join public.customer_orders co
      on co.id = da.customer_order_id
    where da.courier_user_id = courier_live_locations.user_id
      and da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
      and co.canonical_status not in ('delivered', 'cancelled', 'rejected', 'failed', 'refunded')
      and (
        co.customer_user_id = auth.uid()
        or public.rc_ordera_can_manage_restaurant(co.user_id, 'view_orders')
      )
  )
);

create or replace function public.rc_ordera_notify_delivery_offer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'offered' then
    insert into public.notifications (
      recipient_user_id, notification_type, title, body,
      reference_type, reference_id, channels, payload
    ) values (
      new.courier_user_id,
      'courier_assigned',
      'Nuevo domicilio - RC ORDERA',
      'Hay un nuevo pedido disponible. Abre RC ORDERA para revisarlo.',
      'delivery_assignment',
      new.id,
      '["in_app","push"]'::jsonb,
      jsonb_build_object(
        'assignment_id', new.id,
        'customer_order_id', new.customer_order_id,
        'url', './colaborador.html?view=offers&assignment=' || new.id::text || '&app=v84.1'
      )
    )
    on conflict (recipient_user_id, notification_type, reference_type, reference_id)
      where reference_id is not null
    do update set
      title = excluded.title,
      body = excluded.body,
      channels = excluded.channels,
      payload = excluded.payload,
      created_at = now(),
      read_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists rc_ordera_notify_delivery_offer_trigger
  on public.delivery_assignments;

create trigger rc_ordera_notify_delivery_offer_trigger
after insert or update of status on public.delivery_assignments
for each row
when (new.status = 'offered')
execute function public.rc_ordera_notify_delivery_offer();

grant select on public.courier_live_locations to authenticated;

revoke all on function public.set_courier_availability(boolean) from public, anon;
revoke all on function public.upsert_courier_live_location(boolean, numeric, numeric, integer) from public, anon;
revoke all on function public.get_customer_order_tracking(uuid, text) from public;
revoke all on function public.get_current_restaurant_delivery_tracking() from public, anon;
revoke all on function public.get_my_courier_delivery_history() from public, anon;
revoke all on function public.rc_ordera_notify_delivery_offer() from public, anon, authenticated;

grant execute on function public.set_courier_availability(boolean) to authenticated;
grant execute on function public.upsert_courier_live_location(boolean, numeric, numeric, integer) to authenticated;
grant execute on function public.get_customer_order_tracking(uuid, text) to anon, authenticated;
grant execute on function public.get_current_restaurant_delivery_tracking() to authenticated;
grant execute on function public.get_my_courier_delivery_history() to authenticated;

do $realtime$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'customer_orders',
      'delivery_assignments',
      'courier_live_locations',
      'notifications',
      'order_status_history'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$realtime$;

do $verify$
begin
  if to_regprocedure('public.get_customer_order_tracking(uuid,text)') is null
     or to_regprocedure('public.get_current_restaurant_delivery_tracking()') is null
     or to_regprocedure('public.get_my_courier_delivery_history()') is null
     or to_regprocedure('public.set_courier_availability(boolean)') is null
     or to_regprocedure('public.upsert_courier_live_location(boolean,numeric,numeric,integer)') is null then
    raise exception 'V84.1 no pudo completar los contratos requeridos.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'courier_live_locations'
      and policyname = 'Active order participants read courier live location'
  ) then
    raise exception 'No se creo la politica de seguimiento V84.1.';
  end if;
end;
$verify$;

notify pgrst, 'reload schema';

commit;

