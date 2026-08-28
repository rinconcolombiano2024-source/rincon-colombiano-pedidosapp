-- RC ORDERA v72
-- Persistencia atomica, horario, apertura operativa y directorio publico sin duplicados.
-- Migracion incremental: no elimina tablas, usuarios, pedidos ni menus existentes.

begin;

do $$
begin
  if to_regclass('public.app_settings') is null
     or to_regclass('public.restaurant_profiles') is null then
    raise exception 'Faltan app_settings o restaurant_profiles. Ejecuta primero el esquema base y V71.';
  end if;
end;
$$;

alter table public.restaurant_profiles
  add column if not exists operational_open boolean not null default false,
  add column if not exists opening_hours jsonb not null default '{}'::jsonb,
  add column if not exists latitude numeric(10, 7) null,
  add column if not exists longitude numeric(10, 7) null,
  add column if not exists deleted_at timestamptz null;

update public.restaurant_profiles rp
set operational_open = case lower(coalesce(s.settings->>'restaurantOperationalOpen', ''))
      when 'true' then true
      when 'false' then false
      else rp.operational_open
    end,
    opening_hours = case
      when jsonb_typeof(s.settings->'openingHours') = 'object' then s.settings->'openingHours'
      else rp.opening_hours
    end,
    latitude = case
      when coalesce(s.settings->>'restaurantLatitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
        then (s.settings->>'restaurantLatitude')::numeric
      else rp.latitude
    end,
    longitude = case
      when coalesce(s.settings->>'restaurantLongitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
        then (s.settings->>'restaurantLongitude')::numeric
      else rp.longitude
    end
from public.app_settings s
where s.user_id = rp.user_id;

-- Compatibilidad con V69-V71: antes active=false significaba tanto cerrar como eliminar.
-- Las solicitudes explicitas de eliminacion permanecen ocultas; un cierre normal vuelve
-- a ser una sede visible con la atencion operativa cerrada.
do $$
begin
  if to_regclass('public.account_privacy_requests') is not null then
    update public.restaurant_profiles rp
    set active = false,
        operational_open = false,
        deleted_at = coalesce(
          rp.deleted_at,
          (
            select max(apr.created_at)
            from public.account_privacy_requests apr
            where apr.user_id = rp.user_id
              and apr.request_type = 'restaurant_deletion'
              and apr.status in ('requested', 'in_review', 'approved', 'completed')
          )
        ),
        updated_at = now()
    where rp.deleted_at is null
      and exists (
      select 1
      from public.account_privacy_requests apr
      where apr.user_id = rp.user_id
        and apr.request_type = 'restaurant_deletion'
        and apr.status in ('requested', 'in_review', 'approved', 'completed')
    );

    update public.restaurant_profiles rp
    set active = true,
        operational_open = false,
        updated_at = now()
    where rp.active = false
      and rp.deleted_at is null
      and not exists (
        select 1
        from public.account_privacy_requests apr
        where apr.user_id = rp.user_id
          and apr.request_type = 'restaurant_deletion'
          and apr.status in ('requested', 'in_review', 'approved', 'completed')
      );
  end if;
end;
$$;

create index if not exists restaurant_profiles_public_directory_idx
  on public.restaurant_profiles (active, deleted_at, operational_open, updated_at desc);

create or replace function public.save_current_restaurant_state(
  p_menu jsonb,
  p_settings jsonb,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  v_opening_hours jsonb := '{}'::jsonb;
  v_latitude numeric(10, 7);
  v_longitude numeric(10, 7);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1
    from public.restaurant_profiles rp
    where rp.user_id = v_user_id
  ) and not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role = 'restaurant_owner'
      and ur.status = 'active'
  ) then
    raise exception 'Restaurant owner role required';
  end if;
  if jsonb_typeof(coalesce(p_menu, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_settings, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_profile, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid restaurant payload';
  end if;

  select * into v_existing
  from public.restaurant_profiles
  where user_id = v_user_id
  for update;
  v_profile_exists := found;

  select coalesce(settings, '{}'::jsonb)
  into v_existing_settings
  from public.app_settings
  where user_id = v_user_id;

  v_name := left(coalesce(
    nullif(trim(p_profile->>'businessName'), ''),
    nullif(trim(v_existing.business_name), ''),
    nullif(trim(p_settings->>'businessName'), ''),
    'Restaurante'
  ), 160);

  if (not v_profile_exists or lower(trim(coalesce(v_existing.business_name, ''))) <> lower(trim(v_name)))
     and exists (
       select 1
       from public.restaurant_profiles other
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
    when coalesce(p_profile->>'latitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
      then (p_profile->>'latitude')::numeric
    else v_existing.latitude
  end;
  v_longitude := case
    when coalesce(p_profile->>'longitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
      then (p_profile->>'longitude')::numeric
    else v_existing.longitude
  end;

  if v_latitude is not null and (v_latitude < -90 or v_latitude > 90) then
    raise exception 'Invalid latitude';
  end if;
  if v_longitude is not null and (v_longitude < -180 or v_longitude > 180) then
    raise exception 'Invalid longitude';
  end if;

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
      'openingHours', v_opening_hours,
      'restaurantLatitude', v_latitude,
      'restaurantLongitude', v_longitude
    );

  insert into public.app_settings (user_id, menu, settings, updated_at)
  values (v_user_id, v_menu, v_settings, now())
  on conflict (user_id)
  do update set
    menu = excluded.menu,
    settings = excluded.settings,
    updated_at = now();

  insert into public.restaurant_profiles (
    user_id, business_name, logo_url, public_address, phone, description,
    active, operational_open, opening_hours, latitude, longitude, deleted_at, updated_at
  )
  values (
    v_user_id, v_name, v_logo, v_address, v_phone, v_description,
    coalesce(v_existing.active, true), v_operational_open, v_opening_hours,
    v_latitude, v_longitude, null, now()
  )
  on conflict (user_id)
  do update set
    business_name = excluded.business_name,
    logo_url = excluded.logo_url,
    public_address = excluded.public_address,
    phone = excluded.phone,
    description = excluded.description,
    operational_open = excluded.operational_open,
    opening_hours = excluded.opening_hours,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    updated_at = now();

  select to_jsonb(rp) into v_profile_json
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;

  return jsonb_build_object(
    'menu', v_menu,
    'settings', v_settings,
    'profile', v_profile_json
  );
end;
$$;

create or replace function public.set_current_restaurant_operational_open(p_open boolean)
returns table (
  restaurant_user_id uuid,
  operational_open boolean,
  changed_at timestamptz
)
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
  if not exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = v_user_id
      and rp.active = true
      and rp.deleted_at is null
  ) then
    raise exception 'Active restaurant not found';
  end if;

  update public.restaurant_profiles
  set operational_open = coalesce(p_open, false),
      updated_at = now()
  where user_id = v_user_id;

  update public.app_settings
  set settings = coalesce(settings, '{}'::jsonb)
        || jsonb_build_object('restaurantOperationalOpen', coalesce(p_open, false)),
      updated_at = now()
  where user_id = v_user_id;

  return query
  select rp.user_id, rp.operational_open, rp.updated_at
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;
end;
$$;

create or replace function public.get_public_restaurant_directory()
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
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
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
  )
  select
    r.user_id,
    r.business_name,
    r.logo_url,
    r.public_address,
    r.phone,
    r.description,
    r.operational_open,
    r.opening_hours,
    r.latitude,
    r.longitude,
    r.updated_at
  from ranked r
  where r.duplicate_rank = 1
  order by r.business_name, r.public_address;
$$;

create or replace function public.get_public_restaurant_menu(p_user_id uuid)
returns table(menu jsonb, settings jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(s.menu, '{}'::jsonb) as menu,
    jsonb_strip_nulls(
      coalesce(s.settings, '{}'::jsonb)
      || jsonb_build_object(
        'businessName', coalesce(nullif(s.settings->>'businessName', ''), nullif(rp.business_name, ''), 'Restaurante'),
        'businessLogoUrl', coalesce(nullif(s.settings->>'businessLogoUrl', ''), nullif(rp.logo_url, '')),
        'restaurantAddress', coalesce(nullif(s.settings->>'restaurantAddress', ''), nullif(rp.public_address, '')),
        'restaurantActive', rp.active,
        'restaurantOperationalOpen', rp.operational_open,
        'openingHours', rp.opening_hours,
        'restaurantLatitude', rp.latitude,
        'restaurantLongitude', rp.longitude
      )
    ) as settings
  from public.app_settings s
  join public.restaurant_profiles rp
    on rp.user_id = s.user_id
   and rp.active = true
   and rp.deleted_at is null
  where s.user_id = p_user_id
  limit 1;
$$;

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
set search_path = public
as $$
begin
  if p_public_token is null or length(trim(p_public_token)) < 8 then
    raise exception 'Invalid public token';
  end if;
  if not exists (
    select 1
    from public.restaurant_profiles rp
    where rp.user_id = p_user_id
      and rp.active = true
      and rp.deleted_at is null
      and rp.operational_open = true
  ) then
    raise exception 'Restaurant is closed';
  end if;

  return query
  insert into public.customer_orders (
    id, public_token, user_id, customer_user_id, status, table_label,
    customer_name, order_type, order_json, total, created_at, updated_at
  )
  values (
    coalesce(p_id, gen_random_uuid()), p_public_token, p_user_id, auth.uid(), 'pending',
    left(coalesce(p_table_label, ''), 160), left(coalesce(p_customer_name, ''), 160),
    coalesce(p_order_type, 'Comer en el punto'), coalesce(p_order_json, '{}'::jsonb),
    greatest(coalesce(p_total, 0), 0), now(), now()
  )
  returning public.customer_orders.id, public.customer_orders.public_token;
end;
$$;

drop policy if exists "Public read active restaurant profiles" on public.restaurant_profiles;
create policy "Public read active restaurant profiles"
on public.restaurant_profiles
for select
using (active = true and deleted_at is null);

drop policy if exists "Public read app menu settings" on public.app_settings;
create policy "Public read app menu settings"
on public.app_settings
for select
using (
  exists (
    select 1
    from public.restaurant_profiles rp
    where rp.user_id = app_settings.user_id
      and rp.active = true
      and rp.deleted_at is null
  )
);

alter table public.restaurant_profiles replica identity full;
alter table public.app_settings replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'restaurant_profiles'
    ) then
      alter publication supabase_realtime add table public.restaurant_profiles;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'app_settings'
    ) then
      alter publication supabase_realtime add table public.app_settings;
    end if;
  end if;
end;
$$;

revoke all on function public.save_current_restaurant_state(jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.set_current_restaurant_operational_open(boolean) from public, anon;
grant execute on function public.save_current_restaurant_state(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.set_current_restaurant_operational_open(boolean) to authenticated;
revoke all on function public.get_public_restaurant_directory() from public;
revoke all on function public.get_public_restaurant_menu(uuid) from public;
revoke all on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) from public;
grant execute on function public.get_public_restaurant_directory() to anon, authenticated;
grant execute on function public.get_public_restaurant_menu(uuid) to anon, authenticated;
grant execute on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobacion: debe mostrar una sola fila por nombre y direccion.
select * from public.get_public_restaurant_directory();
