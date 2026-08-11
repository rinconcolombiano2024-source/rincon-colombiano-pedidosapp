-- RC ORDERA V81
-- Entregas: ofertas secuenciales por distancia, vencimiento y aceptacion atomica.
-- Migracion incremental e idempotente. No elimina tablas, datos ni politicas RLS.

begin;

do $preflight$
begin
  if to_regclass('public.customer_orders') is null
     or to_regclass('public.courier_profiles') is null
     or to_regclass('public.courier_live_locations') is null
     or to_regclass('public.delivery_assignments') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.user_roles') is null then
    raise exception 'Falta la estructura de entregas. Ejecuta primero las migraciones V63 y V76.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courier_live_locations' and column_name = 'country_code'
  ) then
    raise exception 'Falta courier_live_locations.country_code. Ejecuta primero la migracion V76.';
  end if;
end;
$preflight$;

-- Funcion interna: conserva un solo sistema de asignacion y no queda expuesta al frontend.
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
begin
  select co.*
  into v_order
  from public.customer_orders co
  where co.id = p_customer_order_id
    and co.user_id = p_restaurant_user_id
  for update;

  if not found then raise exception 'Order not found'; end if;
  if coalesce(v_order.order_type, '') <> 'Domicilio' then raise exception 'Order is not delivery'; end if;

  select rp.latitude, rp.longitude, upper(trim(coalesce(rp.country_code, '')))
  into v_pickup_lat, v_pickup_lng, v_restaurant_country
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
  set status = 'expired',
      updated_at = now()
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
    select
      v_existing.id,
      v_existing.courier_user_id,
      trim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, ''))::text,
      coalesce(cp.phone, '')::text,
      v_existing.distance_km,
      v_existing.status
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
    cp.phone
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
    and cl.updated_at > now() - interval '20 minutes'
    and cl.lat between -90 and 90
    and cl.lng between -180 and 180
    and (v_restaurant_country = '' or upper(trim(cl.country_code)) = v_restaurant_country)
    and not exists (
      select 1
      from public.delivery_assignments previous_offer
      where previous_offer.customer_order_id = v_order.id
        and previous_offer.courier_user_id = cl.user_id
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
    case
      when candidate_distance.km <= 5 then 0
      when candidate_distance.km <= 10 then 1
      when candidate_distance.km <= 20 then 2
      else 3
    end,
    candidate_distance.km asc,
    cl.updated_at desc,
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
    offer_expires_at,
    updated_at
  ) values (
    v_order.id,
    p_restaurant_user_id,
    v_candidate.user_id,
    'offered',
    v_candidate.km,
    v_pickup_lat,
    v_pickup_lng,
    v_candidate.lat,
    v_candidate.lng,
    now() + interval '3 minutes',
    now()
  )
  returning * into v_existing;

  update public.customer_orders co
  set assigned_courier_user_id = v_existing.courier_user_id,
      courier_assignment_status = 'offered',
      updated_at = now()
  where co.id = v_order.id;

  return query
  select
    v_existing.id,
    v_existing.courier_user_id,
    trim(coalesce(v_candidate.first_name, '') || ' ' || coalesce(v_candidate.last_name, ''))::text,
    coalesce(v_candidate.phone, '')::text,
    v_existing.distance_km,
    v_existing.status;
end;
$$;

-- Contrato existente del panel del restaurante.
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
set search_path = pg_catalog, public
as $$
declare
  v_restaurant_user_id uuid := auth.uid();
begin
  if v_restaurant_user_id is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1
    from public.customer_orders co
    where co.id = p_customer_order_id
      and co.user_id = v_restaurant_user_id
  ) then
    raise exception 'Order not found';
  end if;

  return query
  select offered.assignment_id, offered.courier_user_id, offered.courier_name,
         offered.courier_phone, offered.distance_km, offered.status
  from public.rc_ordera_offer_next_courier(p_customer_order_id, v_restaurant_user_id) offered;
end;
$$;

-- Contrato existente del colaborador. Una consulta activa tambien avanza ofertas vencidas.
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
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_expired record;
  v_expired_assignment_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

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
    raise exception 'Courier profile is not approved';
  end if;

  for v_expired in
    select da.id, da.customer_order_id, da.restaurant_user_id, da.courier_user_id
    from public.delivery_assignments da
    where da.status = 'offered'
      and da.offer_expires_at <= now()
    order by da.offer_expires_at asc
    limit 100
  loop
    perform 1
    from public.customer_orders co
    where co.id = v_expired.customer_order_id
    for update;

    v_expired_assignment_id := null;
    update public.delivery_assignments da
    set status = 'expired',
        updated_at = now()
    where da.id = v_expired.id
      and da.status = 'offered'
      and da.offer_expires_at <= now()
    returning da.id into v_expired_assignment_id;

    if v_expired_assignment_id is not null then
      update public.customer_orders co
      set assigned_courier_user_id = null,
          courier_assignment_status = 'expired',
          updated_at = now()
      where co.id = v_expired.customer_order_id
        and co.assigned_courier_user_id = v_expired.courier_user_id
        and co.courier_assignment_status = 'offered';

      perform 1
      from public.rc_ordera_offer_next_courier(
        v_expired.customer_order_id,
        v_expired.restaurant_user_id
      )
      limit 1;
    end if;
  end loop;

  return query
  select
    da.id as assignment_id,
    co.id as customer_order_id,
    da.restaurant_user_id,
    coalesce(nullif(rp.business_name, ''), nullif(s.settings->>'businessName', ''), 'Restaurante')::text,
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
  where da.courier_user_id = v_user_id
    and (
      da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
      or (da.status = 'offered' and da.offer_expires_at > now())
    )
  order by da.created_at asc;
end;
$$;

-- Contrato existente del colaborador. La fila del pedido se bloquea antes de aceptar.
create or replace function public.update_delivery_assignment_status(
  p_assignment_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_customer_order_id uuid;
  v_assignment public.delivery_assignments%rowtype;
  v_order public.customer_orders%rowtype;
  v_customer_status text;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if v_status not in ('accepted', 'rejected', 'arrived_restaurant', 'picked_up', 'arrived_customer', 'delivered', 'cancelled') then
    raise exception 'Invalid assignment status';
  end if;

  select da.customer_order_id
  into v_customer_order_id
  from public.delivery_assignments da
  where da.id = p_assignment_id;

  if v_customer_order_id is null then raise exception 'Assignment not found'; end if;

  select co.*
  into v_order
  from public.customer_orders co
  where co.id = v_customer_order_id
  for update;

  select da.*
  into v_assignment
  from public.delivery_assignments da
  where da.id = p_assignment_id
    and (da.courier_user_id = v_user_id or da.restaurant_user_id = v_user_id)
  for update;

  if not found then raise exception 'Assignment not found'; end if;

  if v_assignment.status = 'offered' and v_assignment.offer_expires_at <= now() then
    raise exception 'Offer expired';
  end if;

  if v_user_id = v_assignment.courier_user_id
     and v_assignment.status = 'offered'
     and v_status not in ('accepted', 'rejected') then
    raise exception 'Accept or reject first';
  end if;

  if v_status = 'accepted' then
    if v_assignment.status <> 'offered'
       or v_order.assigned_courier_user_id is distinct from v_assignment.courier_user_id
       or v_order.courier_assignment_status <> 'offered' then
      raise exception 'Offer is no longer available';
    end if;

    update public.delivery_assignments da
    set status = 'accepted',
        updated_at = now()
    where da.id = v_assignment.id
      and da.status = 'offered'
      and da.offer_expires_at > now();

    if not found then raise exception 'Offer is no longer available'; end if;

    update public.delivery_assignments da
    set status = 'expired',
        updated_at = now()
    where da.customer_order_id = v_assignment.customer_order_id
      and da.id <> v_assignment.id
      and da.status = 'offered';

    update public.customer_orders co
    set assigned_courier_user_id = v_assignment.courier_user_id,
        courier_assignment_status = 'accepted',
        status = 'accepted',
        updated_at = now()
    where co.id = v_assignment.customer_order_id;

    update public.courier_live_locations cl
    set available = false,
        updated_at = now()
    where cl.user_id = v_assignment.courier_user_id;
    return;
  end if;

  if v_status = 'rejected' then
    if v_assignment.status <> 'offered' then raise exception 'Offer is no longer available'; end if;

    update public.delivery_assignments da
    set status = 'rejected',
        updated_at = now()
    where da.id = v_assignment.id;

    update public.customer_orders co
    set assigned_courier_user_id = null,
        courier_assignment_status = 'rejected',
        updated_at = now()
    where co.id = v_assignment.customer_order_id
      and co.assigned_courier_user_id = v_assignment.courier_user_id;

    perform 1
    from public.rc_ordera_offer_next_courier(
      v_assignment.customer_order_id,
      v_assignment.restaurant_user_id
    )
    limit 1;
    return;
  end if;

  update public.delivery_assignments da
  set status = v_status,
      updated_at = now()
  where da.id = v_assignment.id;

  v_customer_status := case
    when v_status = 'picked_up' then 'sent'
    when v_status = 'delivered' then 'delivered'
    else null
  end;

  update public.customer_orders co
  set courier_assignment_status = v_status,
      assigned_courier_user_id = case when v_status = 'cancelled' then null else co.assigned_courier_user_id end,
      status = coalesce(v_customer_status, co.status),
      updated_at = now()
  where co.id = v_assignment.customer_order_id;

  if v_status = 'delivered' then
    update public.courier_live_locations cl
    set available = true,
        updated_at = now()
    where cl.user_id = v_assignment.courier_user_id;
  end if;
end;
$$;

revoke all on function public.rc_ordera_offer_next_courier(uuid, uuid) from public, anon, authenticated;

revoke all on function public.assign_nearest_courier(uuid) from public, anon;
revoke all on function public.get_courier_delivery_offers() from public, anon;
revoke all on function public.update_delivery_assignment_status(uuid, text) from public, anon;

grant execute on function public.assign_nearest_courier(uuid) to authenticated;
grant execute on function public.get_courier_delivery_offers() to authenticated;
grant execute on function public.update_delivery_assignment_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Validacion de firmas despues de ejecutar:
-- select to_regprocedure('public.assign_nearest_courier(uuid)');
-- select to_regprocedure('public.get_courier_delivery_offers()');
-- select to_regprocedure('public.update_delivery_assignment_status(uuid,text)');
-- select has_function_privilege('authenticated', 'public.get_courier_delivery_offers()', 'EXECUTE');
