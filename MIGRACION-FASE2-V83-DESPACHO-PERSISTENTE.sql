-- RC ORDERA V83
-- Disponibilidad persistente y despacho secuencial automatico por cercania.
-- Ejecutar despues de MIGRACION-FASE1-V82-ESTABILIDAD-CORE.sql.
-- Incremental e idempotente. No elimina tablas, usuarios, pedidos ni historicos.

begin;

do $preflight$
begin
  if to_regclass('public.customer_orders') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.courier_profiles') is null
     or to_regclass('public.courier_live_locations') is null
     or to_regclass('public.delivery_assignments') is null
     or to_regclass('public.platform_audit_logs') is null
     or to_regclass('public.order_status_history') is null
     or to_regprocedure('public.rc_ordera_offer_next_courier(uuid,uuid)') is null then
    raise exception 'Falta el nucleo de RC ORDERA. Ejecuta primero las migraciones hasta V82.';
  end if;
end;
$preflight$;

alter table public.courier_live_locations
  add column if not exists available_since timestamptz null,
  add column if not exists last_location_at timestamptz null;

update public.courier_live_locations cl
set available_since = case when cl.available then coalesce(cl.available_since, cl.updated_at) else null end,
    last_location_at = coalesce(cl.last_location_at, cl.updated_at)
where (cl.available and cl.available_since is null)
   or cl.last_location_at is null;

create index if not exists courier_live_locations_dispatch_idx
  on public.courier_live_locations (available, country_code, updated_at desc)
  where available = true;

-- La ubicacion y la disponibilidad son estados diferentes. Una escritura GPS
-- nunca desconecta al colaborador; solo el RPC de disponibilidad puede hacerlo.
create or replace function public.set_courier_availability(p_available boolean)
returns table(available boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

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
      where cp.user_id = v_user_id and cp.status = 'approved'
    ) then raise exception 'Courier profile is not approved'; end if;

    update public.courier_live_locations cl
    set available = true,
        available_since = coalesce(cl.available_since, now()),
        updated_at = now()
    where cl.user_id = v_user_id
      and cl.lat between -90 and 90
      and cl.lng between -180 and 180;
    if not found then raise exception 'Share a valid location before going online'; end if;
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
  left join public.courier_live_locations cl on cl.user_id = v_user_id;
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
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid location';
  end if;

  select upper(trim(coalesce(cp.country_code, ''))), trim(coalesce(cp.city, '')), trim(coalesce(cp.region, ''))
  into v_country_code, v_city, v_region
  from public.courier_profiles cp
  join public.user_roles ur
    on ur.user_id = cp.user_id
   and ur.role = 'platform_courier'
   and ur.scope_type = 'platform'
   and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
   and ur.status = 'active'
  where cp.user_id = v_user_id and cp.status = 'approved';

  if not found then raise exception 'Courier profile is not approved'; end if;

  insert into public.courier_live_locations (
    user_id, available, lat, lng, accuracy_m, country_code, city, region,
    available_since, last_location_at, updated_at
  ) values (
    v_user_id, coalesce(p_available, false), p_lat, p_lng,
    greatest(coalesce(p_accuracy_m, 0), 0), v_country_code, v_city, v_region,
    case when coalesce(p_available, false) then now() else null end, now(), now()
  )
  on conflict on constraint courier_live_locations_pkey
  do update set
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

create or replace function public.rc_ordera_audit_courier_availability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' or old.available is distinct from new.available then
    insert into public.platform_audit_logs (
      actor_user_id, actor_role, action, entity_type, entity_id,
      before_data, after_data, metadata
    ) values (
      coalesce(v_actor, new.user_id),
      case
        when v_actor is null then 'system'
        when public.rc_ordera_is_platform_admin(v_actor) then 'platform_admin'
        else 'platform_courier'
      end,
      case when new.available then 'courier_online' else 'courier_offline' end,
      'courier_live_location', new.user_id,
      jsonb_build_object('available', case when tg_op = 'INSERT' then null else old.available end),
      jsonb_build_object('available', new.available),
      jsonb_build_object('source', case when v_actor is null then 'backend' else 'application' end)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists rc_ordera_audit_courier_availability_trigger on public.courier_live_locations;
create trigger rc_ordera_audit_courier_availability_trigger
after insert or update of available on public.courier_live_locations
for each row execute function public.rc_ordera_audit_courier_availability();

-- Selecciona primero por distancia real calculada con la ultima ubicacion
-- conocida. La antiguedad del GPS se registra, pero no cambia available=false.
create or replace function public.rc_ordera_offer_next_courier(
  p_customer_order_id uuid,
  p_restaurant_user_id uuid
)
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
set search_path = pg_catalog, public
as $$
declare
  v_order public.customer_orders%rowtype;
  v_existing public.delivery_assignments%rowtype;
  v_candidate record;
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_restaurant_country text := '';
  v_restaurant_region text := '';
  v_score numeric;
  v_reason jsonb;
  v_customer_distance numeric := 0;
  v_estimated_pickup_at timestamptz;
  v_estimated_delivery_at timestamptz;
begin
  select co.*
  into v_order
  from public.customer_orders co
  where co.id = p_customer_order_id
    and co.user_id = p_restaurant_user_id
  for update;

  if not found then raise exception 'Order not found'; end if;
  if coalesce(v_order.order_type, '') <> 'Domicilio' then raise exception 'Order is not delivery'; end if;
  if v_order.status in ('delivered', 'cancelled') then return; end if;

  select rp.latitude, rp.longitude, upper(trim(coalesce(rp.country_code, ''))), lower(trim(coalesce(rp.region, '')))
  into v_pickup_lat, v_pickup_lng, v_restaurant_country, v_restaurant_region
  from public.restaurant_profiles rp
  where rp.user_id = p_restaurant_user_id
    and rp.active = true
    and rp.deleted_at is null;

  if v_pickup_lat is null or v_pickup_lng is null then
    select pll.lat, pll.lng
    into v_pickup_lat, v_pickup_lng
    from public.app_settings s
    cross join lateral public.parse_lat_lng(s.settings->>'restaurantAddress') pll
    where s.user_id = p_restaurant_user_id
    limit 1;
  end if;

  if v_pickup_lat is null or v_pickup_lng is null then
    update public.customer_orders co
    set assigned_courier_user_id = null,
        courier_assignment_status = 'no_courier',
        updated_at = now()
    where co.id = v_order.id;
    raise exception 'Restaurant location is missing';
  end if;

  update public.delivery_assignments da
  set status = 'expired', updated_at = now()
  where da.customer_order_id = v_order.id
    and da.status = 'offered'
    and da.offer_expires_at <= now();

  select da.*
  into v_existing
  from public.delivery_assignments da
  where da.customer_order_id = v_order.id
    and (
      da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
      or (da.status = 'offered' and da.offer_expires_at > now())
    )
  order by
    case da.status
      when 'arrived_customer' then 0
      when 'picked_up' then 1
      when 'arrived_restaurant' then 2
      when 'accepted' then 3
      else 4
    end,
    da.created_at desc
  limit 1;

  if found then
    return query
    select v_existing.id, v_existing.courier_user_id,
      trim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, ''))::text,
      coalesce(cp.phone, '')::text, v_existing.distance_km, v_existing.status
    from public.courier_profiles cp
    where cp.user_id = v_existing.courier_user_id;
    return;
  end if;

  update public.customer_orders co
  set assigned_courier_user_id = null,
      courier_assignment_status = case
        when co.courier_assignment_status = 'offered' then 'expired'
        else co.courier_assignment_status
      end,
      updated_at = now()
  where co.id = v_order.id;

  select
    cl.user_id,
    cl.lat,
    cl.lng,
    candidate_distance.km,
    cp.first_name,
    cp.last_name,
    cp.phone,
    cp.vehicle_type,
    greatest(extract(epoch from (now() - coalesce(cl.last_location_at, cl.updated_at))), 0)::integer as location_age_seconds,
    exists (
      select 1
      from public.delivery_assignments recent_offer
      where recent_offer.customer_order_id = v_order.id
        and recent_offer.courier_user_id = cl.user_id
        and recent_offer.updated_at > now() - interval '10 minutes'
    ) as recently_offered
  into v_candidate
  from public.courier_live_locations cl
  join public.courier_profiles cp
    on cp.user_id = cl.user_id
   and cp.status = 'approved'
  join public.user_roles ur
    on ur.user_id = cl.user_id
   and ur.role = 'platform_courier'
   and ur.scope_type = 'platform'
   and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
   and ur.status = 'active'
  cross join lateral (
    select public.distance_km(v_pickup_lat, v_pickup_lng, cl.lat, cl.lng) as km
  ) candidate_distance
  where cl.available = true
    and cl.lat between -90 and 90
    and cl.lng between -180 and 180
    and (v_restaurant_country = '' or upper(trim(cl.country_code)) = v_restaurant_country)
    and (
      v_restaurant_region = ''
      or trim(coalesce(cl.region, '')) = ''
      or lower(trim(cl.region)) = v_restaurant_region
    )
    and not exists (
      select 1
      from public.delivery_assignments busy_assignment
      where busy_assignment.courier_user_id = cl.user_id
        and (
          busy_assignment.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
          or (busy_assignment.status = 'offered' and busy_assignment.offer_expires_at > now())
        )
    )
  order by
    recently_offered asc,
    candidate_distance.km asc,
    coalesce(cl.last_location_at, cl.updated_at) desc,
    cl.user_id
  limit 1;

  if v_candidate.user_id is null then
    update public.customer_orders co
    set assigned_courier_user_id = null,
        courier_assignment_status = 'no_courier',
        updated_at = now()
    where co.id = v_order.id;
    return;
  end if;

  v_score := round(v_candidate.km * 100 + least(v_candidate.location_age_seconds, 86400)::numeric / 3600, 4);
  v_reason := jsonb_build_object(
    'strategy', 'nearest_available_sequential',
    'distance_km', round(v_candidate.km, 3),
    'location_age_seconds', v_candidate.location_age_seconds,
    'location_is_stale', v_candidate.location_age_seconds > 120,
    'reoffered_after_candidate_cycle', v_candidate.recently_offered,
    'country_code', v_restaurant_country,
    'region', v_restaurant_region,
    'vehicle_type', coalesce(v_candidate.vehicle_type, ''),
    'batching_enabled', false
  );
  v_customer_distance := greatest(
    public.rc_ordera_jsonb_numeric(v_order.order_json #> '{delivery,distanceKm}', 0),
    0
  );
  v_estimated_pickup_at := greatest(
    coalesce(v_order.estimated_ready_at, now()),
    now() + make_interval(secs => ceil(greatest(v_candidate.km, 0) / 25 * 3600)::integer)
  );
  v_estimated_delivery_at := v_estimated_pickup_at
    + make_interval(secs => ceil(v_customer_distance / 25 * 3600)::integer)
    + interval '5 minutes';

  insert into public.delivery_assignments (
    customer_order_id, restaurant_user_id, courier_user_id, status,
    distance_km, pickup_lat, pickup_lng, courier_lat, courier_lng,
    offer_expires_at, score, score_reason,
    estimated_pickup_at, estimated_delivery_at, updated_at
  ) values (
    v_order.id, p_restaurant_user_id, v_candidate.user_id, 'offered',
    v_candidate.km, v_pickup_lat, v_pickup_lng, v_candidate.lat, v_candidate.lng,
    now() + interval '3 minutes', v_score, v_reason,
    v_estimated_pickup_at, v_estimated_delivery_at, now()
  )
  on conflict (customer_order_id, courier_user_id)
  do update set
    status = 'offered',
    distance_km = excluded.distance_km,
    pickup_lat = excluded.pickup_lat,
    pickup_lng = excluded.pickup_lng,
    courier_lat = excluded.courier_lat,
    courier_lng = excluded.courier_lng,
    offer_expires_at = excluded.offer_expires_at,
    score = excluded.score,
    score_reason = excluded.score_reason,
    estimated_pickup_at = excluded.estimated_pickup_at,
    estimated_delivery_at = excluded.estimated_delivery_at,
    updated_at = now()
  returning * into v_existing;

  update public.customer_orders co
  set assigned_courier_user_id = v_existing.courier_user_id,
      courier_assignment_status = 'offered',
      estimated_pickup_at = v_estimated_pickup_at,
      estimated_delivery_at = v_estimated_delivery_at,
      updated_at = now()
  where co.id = v_order.id;

  return query
  select v_existing.id, v_existing.courier_user_id,
    trim(coalesce(v_candidate.first_name, '') || ' ' || coalesce(v_candidate.last_name, ''))::text,
    coalesce(v_candidate.phone, '')::text,
    v_existing.distance_km, v_existing.status;
end;
$$;

-- Procesa ofertas vencidas y vuelve a intentar pedidos sin candidato. La tarea
-- se ejecuta en servidor; no depende de que cliente o colaborador tengan abierta la PWA.
create or replace function public.rc_ordera_process_delivery_queue(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item record;
  v_processed integer := 0;
begin
  for v_item in
    select co.id as customer_order_id, co.user_id as restaurant_user_id
    from public.customer_orders co
    where co.order_type = 'Domicilio'
      and co.status not in ('delivered', 'cancelled')
      and co.station_status not in ('completed', 'cancelled')
      and co.courier_assignment_status in ('unassigned', 'rejected', 'expired', 'no_courier', 'offered')
      and not exists (
        select 1
        from public.delivery_assignments active_da
        where active_da.customer_order_id = co.id
          and (
            active_da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
            or (active_da.status = 'offered' and active_da.offer_expires_at > now())
          )
      )
    order by co.created_at asc
    limit greatest(least(coalesce(p_limit, 100), 500), 1)
    for update of co skip locked
  loop
    begin
      update public.delivery_assignments da
      set status = 'expired', updated_at = now()
      where da.customer_order_id = v_item.customer_order_id
        and da.status = 'offered'
        and da.offer_expires_at <= now();

      perform 1
      from public.rc_ordera_offer_next_courier(v_item.customer_order_id, v_item.restaurant_user_id)
      limit 1;
      v_processed := v_processed + 1;
    exception when others then
      insert into public.platform_audit_logs (
        actor_role, action, entity_type, entity_id, restaurant_user_id, metadata
      ) values (
        'system', 'delivery_dispatch_failed', 'customer_order',
        v_item.customer_order_id, v_item.restaurant_user_id,
        jsonb_build_object('sqlstate', sqlstate, 'message', left(sqlerrm, 500))
      );
    end;
  end loop;

  return v_processed;
end;
$$;

-- RPC permitida a service_role y a administradores de plataforma. El frontend
-- normal no puede ejecutar el motor global de despacho.
create or replace function public.process_delivery_dispatch_queue(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.rc_ordera_is_platform_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'Not authorized to process delivery dispatch';
  end if;
  return public.rc_ordera_process_delivery_queue(p_limit);
end;
$$;

-- Crea el historial inicial solo cuando un pedido antiguo aun no tiene eventos.
insert into public.order_status_history (
  customer_order_id, previous_status, new_status, actor_role, source, metadata, created_at
)
select
  co.id, null, co.canonical_status, 'system', 'migration-v83',
  jsonb_build_object(
    'legacy_status', co.status,
    'station_status', co.station_status,
    'courier_status', co.courier_assignment_status
  ),
  co.created_at
from public.customer_orders co
where not exists (
  select 1 from public.order_status_history osh where osh.customer_order_id = co.id
);

revoke all on function public.rc_ordera_process_delivery_queue(integer) from public, anon, authenticated;
revoke all on function public.process_delivery_dispatch_queue(integer) from public, anon;
revoke all on function public.set_courier_availability(boolean) from public, anon;
revoke all on function public.upsert_courier_live_location(boolean, numeric, numeric, integer) from public, anon;

grant execute on function public.process_delivery_dispatch_queue(integer) to authenticated, service_role;
grant execute on function public.set_courier_availability(boolean) to authenticated;
grant execute on function public.upsert_courier_live_location(boolean, numeric, numeric, integer) to authenticated;

-- Si pg_cron esta disponible en el proyecto, instala una tarea cada minuto.
-- Si no esta disponible, la Edge Function delivery-dispatch cubre el mismo contrato.
do $schedule$
declare
  v_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      execute 'create extension if not exists pg_cron with schema pg_catalog';
    exception when others then
      raise notice 'pg_cron no pudo instalarse; configura la Edge Function delivery-dispatch cada minuto.';
    end;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for v_job_id in select jobid from cron.job where jobname = 'rc-ordera-delivery-dispatch-v83'
    loop
      perform cron.unschedule(v_job_id);
    end loop;
    perform cron.schedule(
      'rc-ordera-delivery-dispatch-v83',
      '* * * * *',
      'select public.rc_ordera_process_delivery_queue(100);'
    );
  end if;
exception when others then
  raise notice 'No fue posible programar pg_cron; usa delivery-dispatch como tarea programada: %', sqlerrm;
end;
$schedule$;

do $verify$
begin
  if to_regprocedure('public.rc_ordera_process_delivery_queue(integer)') is null
     or to_regprocedure('public.process_delivery_dispatch_queue(integer)') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'courier_live_locations'
         and column_name = 'available_since'
     ) then
    raise exception 'V83 no pudo completar el contrato de despacho persistente.';
  end if;
end;
$verify$;

notify pgrst, 'reload schema';

commit;
