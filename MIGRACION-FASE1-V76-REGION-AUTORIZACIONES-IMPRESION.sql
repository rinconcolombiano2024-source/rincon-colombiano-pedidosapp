-- RC ORDERA V76
-- Region, autorizaciones verificables y persistencia operativa.
-- Migracion incremental e idempotente: no elimina tablas, usuarios, pedidos, menus ni archivos.

begin;

do $preflight$
begin
  if to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.app_settings') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.courier_profiles') is null
     or to_regclass('public.courier_live_locations') is null
     or to_regclass('public.restaurant_staff_memberships') is null
     or to_regclass('public.restaurant_staff_invitations') is null then
    raise exception 'Falta la estructura base. Ejecuta primero las migraciones V72, V73, V74 y V75.';
  end if;
end;
$preflight$;

alter table public.restaurant_profiles
  add column if not exists region text not null default '',
  add column if not exists postal_code text not null default '';

alter table public.user_profiles
  add column if not exists country_code text not null default '',
  add column if not exists region text not null default '',
  add column if not exists postal_code text not null default '';

alter table public.courier_profiles
  add column if not exists country_code text not null default '',
  add column if not exists region text not null default '',
  add column if not exists postal_code text not null default '',
  add column if not exists preferred_language text not null default 'es',
  add column if not exists detected_timezone text not null default '',
  add column if not exists registration_latitude numeric(10, 7) null,
  add column if not exists registration_longitude numeric(10, 7) null,
  add column if not exists identity_document_url text not null default '',
  add column if not exists driver_license_url text not null default '',
  add column if not exists insurance_url text not null default '';

alter table public.courier_live_locations
  add column if not exists country_code text not null default '',
  add column if not exists city text not null default '',
  add column if not exists region text not null default '';

-- Completa solo paises vacios usando datos ya guardados. No reemplaza informacion existente.
update public.restaurant_profiles rp
set country_code = case
      when rp.timezone = 'Europe/Warsaw'
        or (rp.latitude between 49 and 55.2 and rp.longitude between 14 and 24.3) then 'PL'
      when rp.timezone = 'America/Bogota'
        or (rp.latitude between -5 and 14.5 and rp.longitude between -82 and -66) then 'CO'
      else rp.country_code
    end,
    updated_at = case
      when rp.timezone in ('Europe/Warsaw', 'America/Bogota')
        or (rp.latitude between 49 and 55.2 and rp.longitude between 14 and 24.3)
        or (rp.latitude between -5 and 14.5 and rp.longitude between -82 and -66)
      then now()
      else rp.updated_at
    end
where trim(coalesce(rp.country_code, '')) = '';

create index if not exists restaurant_profiles_region_directory_idx
  on public.restaurant_profiles (country_code, city, region, active, deleted_at, updated_at desc);

create index if not exists courier_live_locations_region_idx
  on public.courier_live_locations (available, country_code, city, updated_at desc);

-- Mantiene la firma existente y completa la region desde el perfil aprobado.
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
    user_id, available, lat, lng, accuracy_m, country_code, city, region, updated_at
  ) values (
    v_user_id, coalesce(p_available, false), p_lat, p_lng,
    greatest(coalesce(p_accuracy_m, 0), 0), v_country_code, v_city, v_region, now()
  )
  on conflict on constraint courier_live_locations_pkey
  do update set
    available = excluded.available,
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy_m = excluded.accuracy_m,
    country_code = excluded.country_code,
    city = excluded.city,
    region = excluded.region,
    updated_at = now();
end;
$$;

-- Asigna solo colaboradores aprobados, disponibles y de la misma region nacional.
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
  v_order public.customer_orders%rowtype;
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_restaurant_country text := '';
  v_existing public.delivery_assignments%rowtype;
  v_candidate record;
begin
  if v_restaurant_user_id is null then raise exception 'Not authenticated'; end if;

  select co.* into v_order
  from public.customer_orders co
  where co.id = p_customer_order_id and co.user_id = v_restaurant_user_id;
  if not found then raise exception 'Order not found'; end if;
  if coalesce(v_order.order_type, '') <> 'Domicilio' then raise exception 'Order is not delivery'; end if;

  select rp.latitude, rp.longitude, upper(trim(coalesce(rp.country_code, '')))
  into v_pickup_lat, v_pickup_lng, v_restaurant_country
  from public.restaurant_profiles rp
  where rp.user_id = v_restaurant_user_id and rp.active = true and rp.deleted_at is null;

  if v_pickup_lat is null or v_pickup_lng is null then
    select pll.lat, pll.lng
    into v_pickup_lat, v_pickup_lng
    from public.app_settings s
    cross join lateral public.parse_lat_lng(s.settings->>'restaurantAddress') pll
    where s.user_id = v_restaurant_user_id
    limit 1;
  end if;

  if v_pickup_lat is null or v_pickup_lng is null then
    update public.customer_orders co
    set courier_assignment_status = 'no_courier', updated_at = now()
    where co.id = v_order.id;
    raise exception 'Restaurant location is missing';
  end if;

  select da.* into v_existing
  from public.delivery_assignments da
  where da.customer_order_id = v_order.id
    and da.status in ('offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
  order by da.created_at desc
  limit 1;

  if found then
    return query
    select v_existing.id, v_existing.courier_user_id,
      trim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, ''))::text,
      cp.phone, v_existing.distance_km, v_existing.status
    from public.courier_profiles cp
    where cp.user_id = v_existing.courier_user_id;
    return;
  end if;

  select cl.user_id, cl.lat, cl.lng,
    public.distance_km(v_pickup_lat, v_pickup_lng, cl.lat, cl.lng) as km,
    cp.first_name, cp.last_name, cp.phone
  into v_candidate
  from public.courier_live_locations cl
  join public.courier_profiles cp on cp.user_id = cl.user_id and cp.status = 'approved'
  join public.user_roles ur
    on ur.user_id = cl.user_id
   and ur.role = 'platform_courier'
   and ur.scope_type = 'platform'
   and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
   and ur.status = 'active'
  where cl.available = true
    and cl.updated_at > now() - interval '20 minutes'
    and (v_restaurant_country = '' or upper(trim(cl.country_code)) = v_restaurant_country)
    and not exists (
      select 1 from public.delivery_assignments active_assignment
      where active_assignment.courier_user_id = cl.user_id
        and active_assignment.status in ('offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
        and active_assignment.updated_at > now() - interval '4 hours'
    )
  order by km asc
  limit 1;

  if v_candidate.user_id is null then
    update public.customer_orders co
    set courier_assignment_status = 'no_courier', updated_at = now()
    where co.id = v_order.id;
    return;
  end if;

  return query
  with inserted as (
    insert into public.delivery_assignments (
      customer_order_id, restaurant_user_id, courier_user_id, status, distance_km,
      pickup_lat, pickup_lng, courier_lat, courier_lng, updated_at
    ) values (
      v_order.id, v_restaurant_user_id, v_candidate.user_id, 'offered', v_candidate.km,
      v_pickup_lat, v_pickup_lng, v_candidate.lat, v_candidate.lng, now()
    )
    on conflict (customer_order_id, courier_user_id)
    do update set
      status = 'offered', distance_km = excluded.distance_km,
      pickup_lat = excluded.pickup_lat, pickup_lng = excluded.pickup_lng,
      courier_lat = excluded.courier_lat, courier_lng = excluded.courier_lng,
      offer_expires_at = now() + interval '3 minutes', updated_at = now()
    returning *
  ), updated_order as (
    update public.customer_orders co
    set assigned_courier_user_id = v_candidate.user_id,
        courier_assignment_status = 'offered', updated_at = now()
    where co.id = v_order.id
    returning co.id
  )
  select inserted.id, inserted.courier_user_id,
    trim(coalesce(v_candidate.first_name, '') || ' ' || coalesce(v_candidate.last_name, ''))::text,
    coalesce(v_candidate.phone, '')::text, inserted.distance_km, inserted.status
  from inserted;
end;
$$;

-- Rechaza pedidos dirigidos a un restaurante cerrado o a otro pais/region declarados.
create or replace function public.create_customer_order(
  p_id uuid,
  p_user_id uuid,
  p_public_token text,
  p_table_label text,
  p_customer_name text,
  p_order_type text,
  p_order_json jsonb,
  p_total numeric
)
returns table(id uuid, public_token text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_restaurant_country text := '';
  v_restaurant_region text := '';
  v_customer_country text := upper(trim(coalesce(p_order_json #>> '{delivery,countryCode}', '')));
  v_customer_region text := lower(trim(coalesce(p_order_json #>> '{delivery,region}', '')));
begin
  if p_public_token is null or length(trim(p_public_token)) < 8 then raise exception 'Invalid public token'; end if;

  select upper(trim(coalesce(rp.country_code, ''))), lower(trim(coalesce(rp.region, '')))
  into v_restaurant_country, v_restaurant_region
  from public.restaurant_profiles rp
  where rp.user_id = p_user_id
    and rp.active = true
    and rp.deleted_at is null
    and case
      when rp.operational_mode = 'schedule' then public.restaurant_schedule_is_open(
        rp.opening_hours,
        coalesce(nullif(trim(rp.timezone), ''), case upper(trim(rp.country_code))
          when 'PL' then 'Europe/Warsaw' when 'CO' then 'America/Bogota' else 'UTC' end),
        now()
      )
      else rp.operational_open
    end = true;
  if not found then raise exception 'Restaurant is closed'; end if;

  if coalesce(p_order_type, '') = 'Domicilio'
     and v_restaurant_country <> ''
     and v_customer_country <> ''
     and v_restaurant_country <> v_customer_country then
    raise exception 'Restaurant country does not match delivery country';
  end if;

  if coalesce(p_order_type, '') = 'Domicilio'
     and v_restaurant_region <> ''
     and v_customer_region <> ''
     and v_restaurant_region <> v_customer_region then
    raise exception 'Restaurant region does not match delivery region';
  end if;

  return query
  insert into public.customer_orders (
    id, public_token, user_id, customer_user_id, status, table_label,
    customer_name, order_type, order_json, total, created_at, updated_at
  ) values (
    coalesce(p_id, gen_random_uuid()), p_public_token, p_user_id, auth.uid(), 'pending',
    left(coalesce(p_table_label, ''), 160), left(coalesce(p_customer_name, ''), 160),
    coalesce(p_order_type, 'Comer en el punto'), coalesce(p_order_json, '{}'::jsonb),
    greatest(coalesce(p_total, 0), 0), now(), now()
  )
  returning public.customer_orders.id, public.customer_orders.public_token;
end;
$$;

-- Guarda menu, configuracion, perfil y ubicacion en una sola transaccion confirmada.
create or replace function public.save_current_restaurant_state(
  p_menu jsonb,
  p_settings jsonb,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.restaurant_profiles%rowtype;
  v_profile_exists boolean := false;
  v_existing_settings jsonb := '{}'::jsonb;
  v_menu jsonb;
  v_settings jsonb;
  v_profile_json jsonb;
  v_name text;
  v_logo text;
  v_address text;
  v_phone text;
  v_description text;
  v_operational_open boolean := false;
  v_operational_mode text := 'manual';
  v_opening_hours jsonb := '{}'::jsonb;
  v_latitude numeric(10, 7);
  v_longitude numeric(10, 7);
  v_country_code text := '';
  v_city text := '';
  v_region text := '';
  v_postal_code text := '';
  v_timezone text := '';
  v_language text := 'es';
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if jsonb_typeof(coalesce(p_menu, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_settings, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_profile, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid restaurant payload';
  end if;

  select * into v_existing
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id
  for update;
  v_profile_exists := found;

  if not v_profile_exists and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role = 'restaurant_owner'
      and ur.status = 'active'
  ) then
    raise exception 'Restaurant owner role required';
  end if;

  select coalesce(s.settings, '{}'::jsonb)
  into v_existing_settings
  from public.app_settings s
  where s.user_id = v_user_id;

  v_name := left(coalesce(
    nullif(trim(p_profile->>'businessName'), ''),
    nullif(trim(v_existing.business_name), ''),
    nullif(trim(p_settings->>'businessName'), ''),
    'Restaurante'
  ), 160);

  if (not v_profile_exists or lower(trim(coalesce(v_existing.business_name, ''))) <> lower(trim(v_name)))
     and exists (
       select 1 from public.restaurant_profiles other
       where other.user_id <> v_user_id
         and other.active = true
         and other.deleted_at is null
         and lower(trim(other.business_name)) = lower(trim(v_name))
     ) then
    raise exception 'Restaurant name already exists';
  end if;

  v_logo := coalesce(nullif(trim(p_profile->>'logoUrl'), ''), nullif(v_existing.logo_url, ''), '');
  v_address := coalesce(nullif(trim(p_profile->>'publicAddress'), ''), nullif(v_existing.public_address, ''), '');
  v_phone := coalesce(nullif(trim(p_profile->>'phone'), ''), nullif(v_existing.phone, ''), '');
  v_description := coalesce(nullif(trim(p_profile->>'description'), ''), nullif(v_existing.description, ''), '');
  v_country_code := upper(left(coalesce(
    nullif(trim(p_profile->>'countryCode'), ''),
    nullif(trim(p_settings->>'restaurantCountryCode'), ''),
    nullif(trim(v_existing.country_code), ''),
    ''
  ), 2));
  v_city := left(coalesce(
    nullif(trim(p_profile->>'city'), ''),
    nullif(trim(p_settings->>'restaurantCity'), ''),
    nullif(trim(v_existing.city), ''),
    ''
  ), 120);
  v_region := left(coalesce(
    nullif(trim(p_profile->>'region'), ''),
    nullif(trim(p_settings->>'restaurantRegion'), ''),
    nullif(trim(v_existing.region), ''),
    ''
  ), 120);
  v_postal_code := left(coalesce(
    nullif(trim(p_profile->>'postalCode'), ''),
    nullif(trim(p_settings->>'restaurantPostalCode'), ''),
    nullif(trim(v_existing.postal_code), ''),
    ''
  ), 24);
  v_timezone := left(coalesce(
    nullif(trim(p_profile->>'timezone'), ''),
    nullif(trim(p_settings->>'restaurantTimezone'), ''),
    nullif(trim(v_existing.timezone), ''),
    case v_country_code when 'PL' then 'Europe/Warsaw' when 'CO' then 'America/Bogota' else 'UTC' end
  ), 80);
  v_language := lower(left(coalesce(
    nullif(trim(p_profile->>'preferredLanguage'), ''),
    nullif(trim(p_settings->>'restaurantPreferredLanguage'), ''),
    nullif(trim(v_existing.preferred_language), ''),
    'es'
  ), 8));

  v_operational_mode := case lower(coalesce(
    nullif(trim(p_profile->>'operationalMode'), ''),
    nullif(trim(p_settings->>'restaurantOperationalMode'), ''),
    nullif(trim(v_existing.operational_mode), ''),
    'manual'
  )) when 'schedule' then 'schedule' else 'manual' end;
  v_operational_open := case lower(coalesce(p_profile->>'operationalOpen', ''))
    when 'true' then true
    when 'false' then false
    else coalesce(v_existing.operational_open, false)
  end;
  v_opening_hours := case
    when jsonb_typeof(p_profile->'openingHours') = 'object' then p_profile->'openingHours'
    when jsonb_typeof(v_existing.opening_hours) = 'object' then v_existing.opening_hours
    else '{}'::jsonb
  end;
  v_latitude := case
    when coalesce(p_profile->>'latitude', '') ~ '^-?[0-9]+([.][0-9]+)?$' then (p_profile->>'latitude')::numeric
    else v_existing.latitude
  end;
  v_longitude := case
    when coalesce(p_profile->>'longitude', '') ~ '^-?[0-9]+([.][0-9]+)?$' then (p_profile->>'longitude')::numeric
    else v_existing.longitude
  end;
  if v_latitude is not null and (v_latitude < -90 or v_latitude > 90) then raise exception 'Invalid latitude'; end if;
  if v_longitude is not null and (v_longitude < -180 or v_longitude > 180) then raise exception 'Invalid longitude'; end if;

  v_menu := coalesce(p_menu, '{}'::jsonb);
  v_settings := coalesce(v_existing_settings, '{}'::jsonb)
    || coalesce(p_settings, '{}'::jsonb)
    || jsonb_build_object(
      'businessName', v_name,
      'businessLogoUrl', v_logo,
      'restaurantAddress', v_address,
      'businessPhone', v_phone,
      'restaurantActive', coalesce(v_existing.active, true),
      'restaurantOperationalOpen', v_operational_open,
      'restaurantOperationalMode', v_operational_mode,
      'openingHours', v_opening_hours,
      'restaurantLatitude', v_latitude,
      'restaurantLongitude', v_longitude,
      'restaurantCountryCode', v_country_code,
      'restaurantCity', v_city,
      'restaurantRegion', v_region,
      'restaurantPostalCode', v_postal_code,
      'restaurantTimezone', v_timezone,
      'restaurantPreferredLanguage', v_language
    );

  insert into public.app_settings (user_id, menu, settings, updated_at)
  values (v_user_id, v_menu, v_settings, now())
  on conflict on constraint app_settings_pkey
  do update set menu = excluded.menu, settings = excluded.settings, updated_at = now();

  insert into public.restaurant_profiles (
    user_id, business_name, logo_url, public_address, phone, description,
    active, operational_open, operational_mode, opening_hours, latitude, longitude,
    country_code, city, region, postal_code, timezone, preferred_language, deleted_at, updated_at
  ) values (
    v_user_id, v_name, v_logo, v_address, v_phone, v_description,
    coalesce(v_existing.active, true), v_operational_open, v_operational_mode, v_opening_hours,
    v_latitude, v_longitude, v_country_code, v_city, v_region, v_postal_code,
    v_timezone, v_language, v_existing.deleted_at, now()
  )
  on conflict on constraint restaurant_profiles_pkey
  do update set
    business_name = excluded.business_name,
    logo_url = excluded.logo_url,
    public_address = excluded.public_address,
    phone = excluded.phone,
    description = excluded.description,
    operational_open = excluded.operational_open,
    operational_mode = excluded.operational_mode,
    opening_hours = excluded.opening_hours,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    country_code = excluded.country_code,
    city = excluded.city,
    region = excluded.region,
    postal_code = excluded.postal_code,
    timezone = excluded.timezone,
    preferred_language = excluded.preferred_language,
    updated_at = now();

  select to_jsonb(rp) into v_profile_json
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;

  return jsonb_build_object('menu', v_menu, 'settings', v_settings, 'profile', v_profile_json);
end;
$$;

-- Directorio filtrado por pais y provincia. La ciudad ordena primero los resultados cercanos.
create or replace function public.get_public_restaurant_directory_by_region(
  p_country_code text,
  p_city text,
  p_region text
)
returns table (
  user_id uuid,
  business_name text,
  logo_url text,
  public_address text,
  phone text,
  description text,
  operational_open boolean,
  opening_hours jsonb,
  latitude numeric,
  longitude numeric,
  country_code text,
  city text,
  region text,
  postal_code text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with ranked as (
    select
      rp.*,
      row_number() over (
        partition by lower(trim(rp.business_name)), lower(trim(rp.public_address))
        order by rp.updated_at desc, rp.created_at desc, rp.user_id desc
      ) as duplicate_rank
    from public.restaurant_profiles rp
    where rp.active = true
      and rp.deleted_at is null
      and (
        trim(coalesce(p_country_code, '')) = ''
        or upper(trim(rp.country_code)) = upper(trim(p_country_code))
      )
      and (
        trim(coalesce(p_region, '')) = ''
        or lower(trim(rp.region)) = lower(trim(p_region))
      )
  )
  select
    r.user_id,
    r.business_name,
    r.logo_url,
    r.public_address,
    r.phone,
    r.description,
    case
      when r.operational_mode = 'schedule' then public.restaurant_schedule_is_open(
        r.opening_hours,
        coalesce(nullif(trim(r.timezone), ''), case upper(trim(r.country_code)) when 'PL' then 'Europe/Warsaw' when 'CO' then 'America/Bogota' else 'UTC' end),
        now()
      )
      else r.operational_open
    end,
    r.opening_hours,
    r.latitude,
    r.longitude,
    r.country_code,
    r.city,
    r.region,
    r.postal_code,
    r.updated_at
  from ranked r
  where r.duplicate_rank = 1
  order by
    case when trim(coalesce(p_city, '')) <> '' and lower(trim(r.city)) = lower(trim(p_city)) then 0 else 1 end,
    r.business_name,
    r.public_address;
$$;

-- Funcion interna: una sola escritura verificada para rol y estacion.
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
  if v_station not in ('waiter', 'cashier', 'kitchen', 'packing', 'dispatch', 'manager') then raise exception 'Invalid station'; end if;
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

  if not exists (
    select 1
    from public.restaurant_staff_memberships m
    join public.user_roles ur
      on ur.user_id = m.member_user_id
     and ur.role = 'restaurant_employee'
     and ur.scope_type = 'restaurant'
     and ur.scope_id = m.restaurant_user_id
     and ur.status = 'active'
    where m.restaurant_user_id = p_restaurant_id
      and m.member_user_id = p_staff_user_id
      and m.station = v_station
      and m.active = true
  ) then
    raise exception 'Staff authorization could not be confirmed';
  end if;
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
  if v_station not in ('waiter', 'cashier', 'kitchen', 'packing', 'dispatch', 'manager') then raise exception 'Invalid station'; end if;
  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Employee email is invalid'; end if;

  v_permissions := case when v_station in ('waiter', 'cashier', 'manager') then '{"create_orders":true}'::jsonb else '{}'::jsonb end;
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
    do update set
      station = excluded.station,
      display_name = excluded.display_name,
      permissions = excluded.permissions,
      status = 'pending',
      invited_by_user_id = v_owner_id,
      claimed_by_user_id = null,
      claimed_at = null,
      updated_at = now();
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
  do update set
    station = excluded.station,
    display_name = excluded.display_name,
    permissions = excluded.permissions,
    status = 'claimed',
    invited_by_user_id = v_owner_id,
    claimed_by_user_id = v_member_id,
    claimed_at = now(),
    updated_at = now();

  return query
  select m.member_user_id, v_email, m.station, m.display_name, m.active, false
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = v_owner_id
    and m.member_user_id = v_member_id
    and m.station = v_station
    and m.active = true;
end;
$$;

create or replace function public.confirm_current_restaurant_staff_invitation(p_email text)
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
  v_email text := lower(trim(coalesce(p_email, '')));
  v_member_id uuid;
  v_invitation public.restaurant_staff_invitations%rowtype;
begin
  if v_owner_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = v_owner_id and rp.active = true and rp.deleted_at is null
  ) then raise exception 'Active restaurant owner profile is missing'; end if;

  select i.* into v_invitation
  from public.restaurant_staff_invitations i
  where i.restaurant_user_id = v_owner_id and i.email = v_email and i.status = 'pending'
  for update;

  if not found then
    return query
    select m.member_user_id, coalesce(au.email, '')::text, m.station, m.display_name, m.active, false
    from public.restaurant_staff_memberships m
    join auth.users au on au.id = m.member_user_id
    where m.restaurant_user_id = v_owner_id
      and lower(trim(coalesce(au.email, ''))) = v_email
      and m.active = true
    order by m.updated_at desc
    limit 1;
    if found then return; end if;
    raise exception 'Staff invitation was not found';
  end if;

  select au.id into v_member_id from auth.users au where lower(trim(coalesce(au.email, ''))) = v_email limit 1;
  if v_member_id is null then
    return query select null::uuid, v_email, v_invitation.station, v_invitation.display_name, false, true;
    return;
  end if;

  perform public.activate_restaurant_staff_membership_internal(
    v_owner_id, v_member_id, v_invitation.station,
    v_invitation.display_name, v_invitation.permissions, v_owner_id
  );

  update public.restaurant_staff_invitations i
  set status = 'claimed', claimed_by_user_id = v_member_id,
      claimed_at = now(), updated_at = now()
  where i.restaurant_user_id = v_owner_id and i.email = v_email;

  return query
  select m.member_user_id, v_email, m.station, m.display_name, m.active, false
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = v_owner_id
    and m.member_user_id = v_member_id
    and m.station = v_invitation.station
    and m.active = true;
end;
$$;

create or replace function public.claim_my_restaurant_staff_invitation(p_restaurant_user_id uuid)
returns table (
  restaurant_user_id uuid,
  station text,
  display_name text,
  permissions jsonb,
  business_name text,
  logo_url text,
  active boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_member_id uuid := auth.uid();
  v_email text;
  v_invitation public.restaurant_staff_invitations%rowtype;
begin
  if v_member_id is null then raise exception 'Not authenticated'; end if;
  select lower(trim(au.email)) into v_email from auth.users au where au.id = v_member_id;

  select i.* into v_invitation
  from public.restaurant_staff_invitations i
  where i.restaurant_user_id = p_restaurant_user_id and i.email = v_email and i.status = 'pending'
  for update;

  if found then
    perform public.activate_restaurant_staff_membership_internal(
      p_restaurant_user_id, v_member_id, v_invitation.station,
      v_invitation.display_name, v_invitation.permissions,
      coalesce(v_invitation.invited_by_user_id, p_restaurant_user_id)
    );
    update public.restaurant_staff_invitations i
    set status = 'claimed', claimed_by_user_id = v_member_id,
        claimed_at = now(), updated_at = now()
    where i.restaurant_user_id = p_restaurant_user_id and i.email = v_email;
  end if;

  return query
  select m.restaurant_user_id, m.station, m.display_name, m.permissions,
         coalesce(nullif(rp.business_name, ''), 'Restaurante')::text,
         coalesce(rp.logo_url, '')::text, m.active
  from public.restaurant_staff_memberships m
  join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = v_member_id
    and m.active = true
  order by m.updated_at desc
  limit 1;
end;
$$;

-- Cola administrativa con el contrato exacto consumido por admin.js.
create or replace function public.get_courier_review_queue()
returns table (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  phone text,
  birth_date date,
  country text,
  city text,
  address text,
  identity_document text,
  identity_document_url text,
  photo_url text,
  verification_selfie_url text,
  work_permit_url text,
  vehicle_type text,
  vehicle_plate text,
  driver_license text,
  driver_license_url text,
  insurance_info text,
  insurance_url text,
  bank_account text,
  availability jsonb,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_roles admin_role
    where admin_role.user_id = auth.uid()
      and admin_role.role = 'platform_admin'
      and admin_role.scope_type = 'platform'
      and admin_role.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
      and admin_role.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Not authorized to review couriers';
  end if;

  return query
  select
    cp.user_id,
    coalesce(au.email, '')::text,
    cp.first_name,
    cp.last_name,
    cp.phone,
    cp.birth_date,
    cp.country,
    cp.city,
    cp.address,
    cp.identity_document,
    cp.identity_document_url,
    cp.photo_url,
    cp.verification_selfie_url,
    cp.work_permit_url,
    cp.vehicle_type,
    cp.vehicle_plate,
    cp.driver_license,
    cp.driver_license_url,
    cp.insurance_info,
    cp.insurance_url,
    cp.bank_account,
    cp.availability,
    cp.status,
    cp.created_at,
    cp.updated_at
  from public.courier_profiles cp
  left join auth.users au on au.id = cp.user_id
  order by
    case cp.status
      when 'pending_review' then 0
      when 'draft' then 1
      when 'rejected' then 2
      when 'approved' then 3
      when 'suspended' then 4
      when 'inactive' then 5
      else 6
    end,
    cp.updated_at desc,
    cp.created_at desc;
end;
$$;

-- Aprobacion administrativa atomica y comprobable.
create or replace function public.review_courier_profile(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_role_status text;
begin
  if v_admin_id is null or not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_admin_id
      and ur.role = 'platform_admin'
      and ur.scope_type = 'platform'
      and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
      and ur.status = 'active'
  ) then raise exception using errcode = '42501', message = 'Not authorized to review couriers'; end if;
  if p_user_id is null then raise exception using errcode = '22023', message = 'Courier user id is required'; end if;
  if v_status not in ('approved', 'rejected', 'suspended', 'inactive', 'pending_review') then
    raise exception using errcode = '22023', message = 'Invalid courier status';
  end if;

  update public.courier_profiles cp
  set status = v_status, reviewed_at = now(), reviewed_by_user_id = v_admin_id, updated_at = now()
  where cp.user_id = p_user_id;
  if not found then raise exception using errcode = 'P0002', message = 'Courier profile not found'; end if;

  v_role_status := case v_status
    when 'approved' then 'active'
    when 'rejected' then 'revoked'
    when 'suspended' then 'suspended'
    when 'inactive' then 'inactive'
    else 'pending_review'
  end;

  insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
  values (p_user_id, 'platform_courier', 'platform', '00000000-0000-0000-0000-000000000000'::uuid, v_role_status, now())
  on conflict on constraint user_roles_pkey
  do update set status = excluded.status, updated_at = now();

  if not exists (
    select 1
    from public.courier_profiles cp
    join public.user_roles ur
      on ur.user_id = cp.user_id
     and ur.role = 'platform_courier'
     and ur.scope_type = 'platform'
     and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
    where cp.user_id = p_user_id and cp.status = v_status and ur.status = v_role_status
  ) then raise exception 'Courier approval could not be confirmed'; end if;
end;
$$;

create or replace function public.get_my_courier_approval()
returns table (profile_status text, role_status text, approved boolean, reviewed_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select cp.status::text, coalesce(ur.status, '')::text,
         (cp.status = 'approved' and ur.status = 'active'), cp.reviewed_at
  from public.courier_profiles cp
  left join public.user_roles ur
    on ur.user_id = cp.user_id
   and ur.role = 'platform_courier'
   and ur.scope_type = 'platform'
   and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
  where cp.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.get_courier_review_result(p_user_id uuid)
returns table (profile_status text, role_status text, reviewed_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles admin_role
    where admin_role.user_id = auth.uid()
      and admin_role.role = 'platform_admin'
      and admin_role.scope_type = 'platform'
      and admin_role.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
      and admin_role.status = 'active'
  ) then raise exception using errcode = '42501', message = 'Not authorized to review couriers'; end if;

  return query
  select cp.status::text, coalesce(ur.status, '')::text, cp.reviewed_at
  from public.courier_profiles cp
  left join public.user_roles ur
    on ur.user_id = cp.user_id
   and ur.role = 'platform_courier'
   and ur.scope_type = 'platform'
   and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
  where cp.user_id = p_user_id
  limit 1;
end;
$$;

revoke all on function public.activate_restaurant_staff_membership_internal(uuid, uuid, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.save_current_restaurant_state(jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.get_public_restaurant_directory_by_region(text, text, text) from public;
revoke all on function public.invite_current_restaurant_staff(text, text, text) from public, anon;
revoke all on function public.confirm_current_restaurant_staff_invitation(text) from public, anon;
revoke all on function public.claim_my_restaurant_staff_invitation(uuid) from public, anon;
revoke all on function public.get_courier_review_queue() from public, anon;
revoke all on function public.review_courier_profile(uuid, text) from public, anon;
revoke all on function public.get_my_courier_approval() from public, anon;
revoke all on function public.get_courier_review_result(uuid) from public, anon;
revoke all on function public.upsert_courier_live_location(boolean, numeric, numeric, integer) from public, anon;
revoke all on function public.assign_nearest_courier(uuid) from public, anon;
revoke all on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) from public;

grant execute on function public.save_current_restaurant_state(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.get_public_restaurant_directory_by_region(text, text, text) to anon, authenticated;
grant execute on function public.invite_current_restaurant_staff(text, text, text) to authenticated;
grant execute on function public.confirm_current_restaurant_staff_invitation(text) to authenticated;
grant execute on function public.claim_my_restaurant_staff_invitation(uuid) to authenticated;
grant execute on function public.get_courier_review_queue() to authenticated;
grant execute on function public.review_courier_profile(uuid, text) to authenticated;
grant execute on function public.get_my_courier_approval() to authenticated;
grant execute on function public.get_courier_review_result(uuid) to authenticated;
grant execute on function public.upsert_courier_live_location(boolean, numeric, numeric, integer) to authenticated;
grant execute on function public.assign_nearest_courier(uuid) to authenticated;
grant execute on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) to anon, authenticated;

do $verify$
begin
  if to_regprocedure('public.get_public_restaurant_directory_by_region(text,text,text)') is null
     or to_regprocedure('public.confirm_current_restaurant_staff_invitation(text)') is null
     or to_regprocedure('public.claim_my_restaurant_staff_invitation(uuid)') is null
     or to_regprocedure('public.get_courier_review_queue()') is null
     or to_regprocedure('public.review_courier_profile(uuid,text)') is null
     or to_regprocedure('public.get_courier_review_result(uuid)') is null
     or to_regprocedure('public.upsert_courier_live_location(boolean,numeric,numeric,integer)') is null
     or to_regprocedure('public.assign_nearest_courier(uuid)') is null then
    raise exception 'No se pudieron crear todas las funciones V76';
  end if;
  if has_function_privilege('anon', 'public.confirm_current_restaurant_staff_invitation(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_courier_review_queue()', 'EXECUTE')
     or has_function_privilege('anon', 'public.review_courier_profile(uuid,text)', 'EXECUTE') then
    raise exception 'El rol anon conserva permisos privados indebidos';
  end if;
  if not has_function_privilege('authenticated', 'public.confirm_current_restaurant_staff_invitation(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_courier_review_queue()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.review_courier_profile(uuid,text)', 'EXECUTE') then
    raise exception 'El rol authenticated no recibio permisos V76';
  end if;
end;
$verify$;

notify pgrst, 'reload schema';

commit;

-- Validacion manual posterior (no modifica datos):
-- select to_regprocedure('public.get_public_restaurant_directory_by_region(text,text)');
-- select to_regprocedure('public.confirm_current_restaurant_staff_invitation(text)');
-- select to_regprocedure('public.claim_my_restaurant_staff_invitation(uuid)');
-- select user_id, business_name, country_code, city, region, active, operational_open, operational_mode
-- from public.restaurant_profiles order by updated_at desc;
