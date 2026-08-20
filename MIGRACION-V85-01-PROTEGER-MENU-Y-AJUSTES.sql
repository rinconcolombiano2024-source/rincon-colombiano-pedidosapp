-- RC ORDERA V85.01
-- Proteccion transaccional del menu, revisiones independientes y respaldos.
-- Incremental, idempotente y no destructiva. Requiere el esquema hasta V84.1.

begin;

do $preflight$
begin
  if to_regclass('public.app_settings') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.user_roles') is null then
    raise exception 'Falta la estructura base de RC ORDERA. Ejecuta primero las migraciones hasta V84.1.';
  end if;
end;
$preflight$;

alter table public.app_settings
  add column if not exists menu_revision bigint not null default 1,
  add column if not exists settings_revision bigint not null default 1,
  add column if not exists menu_updated_at timestamptz not null default now(),
  add column if not exists settings_updated_at timestamptz not null default now();

create table if not exists public.restaurant_menu_backups (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete restrict,
  menu jsonb not null,
  settings_snapshot jsonb not null default '{}'::jsonb,
  menu_revision bigint not null,
  product_count integer not null default 0,
  content_hash text not null,
  reason text not null default 'menu_update',
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (restaurant_user_id, menu_revision, content_hash)
);

create index if not exists restaurant_menu_backups_restaurant_created_idx
  on public.restaurant_menu_backups (restaurant_user_id, created_at desc);

alter table public.restaurant_menu_backups enable row level security;

drop policy if exists "Restaurant owners read own menu backups" on public.restaurant_menu_backups;
create policy "Restaurant owners read own menu backups"
on public.restaurant_menu_backups
for select to authenticated
using (
  restaurant_user_id = auth.uid()
  or public.rc_ordera_is_platform_admin(auth.uid())
);

create or replace function public.rc_ordera_menu_product_count(p_menu jsonb)
returns integer
language sql
immutable
set search_path = pg_catalog, public
as $$
  select coalesce(sum(
    case when jsonb_typeof(category.value) = 'array'
      then jsonb_array_length(category.value)
      else 0
    end
  ), 0)::integer
  from jsonb_each(
    case when jsonb_typeof(coalesce(p_menu, '{}'::jsonb)) = 'object'
      then coalesce(p_menu, '{}'::jsonb)
      else '{}'::jsonb
    end
  ) category;
$$;

create or replace function public.rc_ordera_current_user_can_own_restaurant()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.restaurant_profiles rp
      where rp.user_id = auth.uid() and rp.deleted_at is null
    )
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'restaurant_owner'
        and ur.status = 'active'
    )
    or lower(coalesce(auth.jwt() #>> '{user_metadata,account_type}', '')) = 'restaurant'
  );
$$;

create or replace function public.rc_ordera_protect_app_settings()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old_count integer := public.rc_ordera_menu_product_count(old.menu);
  v_new_count integer := public.rc_ordera_menu_product_count(new.menu);
  v_clear_allowed boolean := coalesce(current_setting('rc_ordera.allow_menu_clear', true), '') = 'on';
  v_reason text := coalesce(nullif(current_setting('rc_ordera.menu_backup_reason', true), ''), 'menu_update');
  v_hash text;
begin
  if new.menu is distinct from old.menu then
    if v_old_count > 0 and v_new_count = 0 and not v_clear_allowed then
      raise exception 'MENU_EMPTY_REQUIRES_SECURE_CLEAR';
    end if;

    if v_old_count > 0 then
      v_hash := encode(digest(convert_to(old.menu::text, 'UTF8'), 'sha256'), 'hex');
      insert into public.restaurant_menu_backups (
        restaurant_user_id, menu, settings_snapshot, menu_revision,
        product_count, content_hash, reason, created_by_user_id
      ) values (
        old.user_id, old.menu, coalesce(old.settings, '{}'::jsonb),
        greatest(coalesce(old.menu_revision, 1), 1), v_old_count,
        v_hash, left(v_reason, 80), auth.uid()
      ) on conflict (restaurant_user_id, menu_revision, content_hash) do nothing;
    end if;

    new.menu_revision := greatest(coalesce(old.menu_revision, 1), 1) + 1;
    new.menu_updated_at := now();
  else
    new.menu_revision := old.menu_revision;
    new.menu_updated_at := old.menu_updated_at;
  end if;

  if new.settings is distinct from old.settings then
    new.settings_revision := greatest(coalesce(old.settings_revision, 1), 1) + 1;
    new.settings_updated_at := now();
  else
    new.settings_revision := old.settings_revision;
    new.settings_updated_at := old.settings_updated_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rc_ordera_protect_app_settings_trigger on public.app_settings;
create trigger rc_ordera_protect_app_settings_trigger
before update of menu, settings on public.app_settings
for each row execute function public.rc_ordera_protect_app_settings();

create or replace function public.save_current_restaurant_menu(
  p_menu jsonb,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.app_settings%rowtype;
  v_next_menu jsonb := coalesce(p_menu, '{}'::jsonb);
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.rc_ordera_current_user_can_own_restaurant() then raise exception 'Restaurant owner role required'; end if;
  if jsonb_typeof(v_next_menu) <> 'object' then raise exception 'Invalid menu payload'; end if;

  select s.* into v_row
  from public.app_settings s
  where s.user_id = v_user_id
  for update;

  if not found then
    insert into public.app_settings (
      user_id, menu, settings, menu_revision, settings_revision,
      menu_updated_at, settings_updated_at, updated_at
    ) values (
      v_user_id, v_next_menu, '{}'::jsonb, 1, 1, now(), now(), now()
    ) returning * into v_row;
  else
    if p_expected_revision is not null and p_expected_revision <> v_row.menu_revision then
      raise exception 'MENU_REVISION_CONFLICT';
    end if;
    if public.rc_ordera_menu_product_count(v_row.menu) > 0
       and public.rc_ordera_menu_product_count(v_next_menu) = 0 then
      raise exception 'MENU_EMPTY_REQUIRES_SECURE_CLEAR';
    end if;
    if v_row.menu is distinct from v_next_menu then
      perform set_config('rc_ordera.menu_backup_reason', 'menu_update', true);
      update public.app_settings s
      set menu = v_next_menu
      where s.user_id = v_user_id
      returning * into v_row;
    end if;
  end if;

  return jsonb_build_object(
    'menu', v_row.menu,
    'menuRevision', v_row.menu_revision,
    'menuUpdatedAt', v_row.menu_updated_at
  );
end;
$$;

create or replace function public.save_current_restaurant_settings(
  p_settings jsonb,
  p_profile jsonb,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_settings_row public.app_settings%rowtype;
  v_profile_row public.restaurant_profiles%rowtype;
  v_profile_exists boolean := false;
  v_settings jsonb;
  v_name text;
  v_logo text;
  v_address text;
  v_phone text;
  v_description text;
  v_country text;
  v_city text;
  v_region text;
  v_postal text;
  v_timezone text;
  v_language text;
  v_mode text;
  v_open boolean;
  v_hours jsonb;
  v_lat numeric(10,7);
  v_lng numeric(10,7);
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.rc_ordera_current_user_can_own_restaurant() then raise exception 'Restaurant owner role required'; end if;
  if jsonb_typeof(coalesce(p_settings, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_profile, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid restaurant settings payload';
  end if;

  select s.* into v_settings_row
  from public.app_settings s
  where s.user_id = v_user_id
  for update;
  if found and p_expected_revision is not null and p_expected_revision <> v_settings_row.settings_revision then
    raise exception 'SETTINGS_REVISION_CONFLICT';
  end if;

  select rp.* into v_profile_row
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id
  for update;
  v_profile_exists := found;
  if v_profile_exists and v_profile_row.deleted_at is not null then
    raise exception 'Restaurant is deactivated';
  end if;

  v_name := left(coalesce(
    nullif(trim(p_profile->>'businessName'), ''),
    nullif(trim(v_profile_row.business_name), ''),
    nullif(trim(p_settings->>'businessName'), ''), 'Restaurante'
  ), 160);
  if exists (
    select 1 from public.restaurant_profiles other
    where other.user_id <> v_user_id and other.active = true and other.deleted_at is null
      and lower(trim(other.business_name)) = lower(trim(v_name))
  ) then raise exception 'Restaurant name already exists'; end if;

  v_logo := coalesce(nullif(trim(p_profile->>'logoUrl'), ''), nullif(v_profile_row.logo_url, ''), '');
  v_address := coalesce(nullif(trim(p_profile->>'publicAddress'), ''), nullif(v_profile_row.public_address, ''), '');
  v_phone := coalesce(nullif(trim(p_profile->>'phone'), ''), nullif(v_profile_row.phone, ''), '');
  v_description := coalesce(nullif(trim(p_profile->>'description'), ''), nullif(v_profile_row.description, ''), '');
  v_country := upper(left(coalesce(nullif(trim(p_profile->>'countryCode'), ''), nullif(v_profile_row.country_code, ''), ''), 2));
  v_city := left(coalesce(nullif(trim(p_profile->>'city'), ''), nullif(v_profile_row.city, ''), ''), 120);
  v_region := left(coalesce(nullif(trim(p_profile->>'region'), ''), nullif(v_profile_row.region, ''), ''), 120);
  v_postal := left(coalesce(nullif(trim(p_profile->>'postalCode'), ''), nullif(v_profile_row.postal_code, ''), ''), 24);
  v_timezone := left(coalesce(
    nullif(trim(p_profile->>'timezone'), ''), nullif(v_profile_row.timezone, ''),
    case v_country when 'PL' then 'Europe/Warsaw' when 'CO' then 'America/Bogota' else 'UTC' end
  ), 80);
  v_language := lower(left(coalesce(nullif(trim(p_profile->>'preferredLanguage'), ''), nullif(v_profile_row.preferred_language, ''), 'es'), 8));
  v_mode := case lower(coalesce(nullif(trim(p_profile->>'operationalMode'), ''), nullif(v_profile_row.operational_mode, ''), 'manual'))
    when 'schedule' then 'schedule' else 'manual' end;
  v_open := case lower(coalesce(p_profile->>'operationalOpen', ''))
    when 'true' then true when 'false' then false else coalesce(v_profile_row.operational_open, false) end;
  v_hours := case when jsonb_typeof(p_profile->'openingHours') = 'object' then p_profile->'openingHours'
    when jsonb_typeof(v_profile_row.opening_hours) = 'object' then v_profile_row.opening_hours else '{}'::jsonb end;
  v_lat := case when coalesce(p_profile->>'latitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
    then (p_profile->>'latitude')::numeric else v_profile_row.latitude end;
  v_lng := case when coalesce(p_profile->>'longitude', '') ~ '^-?[0-9]+([.][0-9]+)?$'
    then (p_profile->>'longitude')::numeric else v_profile_row.longitude end;
  if v_lat is not null and (v_lat < -90 or v_lat > 90) then raise exception 'Invalid latitude'; end if;
  if v_lng is not null and (v_lng < -180 or v_lng > 180) then raise exception 'Invalid longitude'; end if;

  v_settings := coalesce(v_settings_row.settings, '{}'::jsonb)
    || coalesce(p_settings, '{}'::jsonb)
    || jsonb_build_object(
      'businessName', v_name, 'businessLogoUrl', v_logo,
      'restaurantAddress', v_address, 'businessPhone', v_phone,
      'restaurantOperationalOpen', v_open, 'restaurantOperationalMode', v_mode,
      'openingHours', v_hours, 'restaurantLatitude', v_lat, 'restaurantLongitude', v_lng,
      'restaurantCountryCode', v_country, 'restaurantCity', v_city,
      'restaurantRegion', v_region, 'restaurantPostalCode', v_postal,
      'restaurantTimezone', v_timezone, 'restaurantPreferredLanguage', v_language
    );

  insert into public.app_settings (
    user_id, menu, settings, menu_revision, settings_revision,
    menu_updated_at, settings_updated_at, updated_at
  ) values (
    v_user_id, '{}'::jsonb, v_settings, 1, 1, now(), now(), now()
  ) on conflict on constraint app_settings_pkey
  do update set settings = excluded.settings
  returning * into v_settings_row;

  insert into public.restaurant_profiles (
    user_id, business_name, logo_url, public_address, phone, description,
    active, operational_open, operational_mode, opening_hours,
    latitude, longitude, country_code, city, region, postal_code,
    timezone, preferred_language, deleted_at, updated_at
  ) values (
    v_user_id, v_name, v_logo, v_address, v_phone, v_description,
    coalesce(v_profile_row.active, true), v_open, v_mode, v_hours,
    v_lat, v_lng, v_country, v_city, v_region, v_postal,
    v_timezone, v_language, null, now()
  ) on conflict on constraint restaurant_profiles_pkey
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
    updated_at = now()
  returning * into v_profile_row;

  return jsonb_build_object(
    'settings', v_settings_row.settings,
    'settingsRevision', v_settings_row.settings_revision,
    'settingsUpdatedAt', v_settings_row.settings_updated_at,
    'profile', to_jsonb(v_profile_row)
  );
end;
$$;

create or replace function public.clear_current_restaurant_menu(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.app_settings%rowtype;
  v_backup_id uuid;
  v_hash text;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.rc_ordera_current_user_can_own_restaurant() then raise exception 'Restaurant owner role required'; end if;
  if coalesce(p_confirmation, '') <> 'VACIAR MENU' then raise exception 'Invalid confirmation phrase'; end if;

  select s.* into v_row from public.app_settings s where s.user_id = v_user_id for update;
  if not found then raise exception 'Restaurant menu was not found'; end if;
  v_count := public.rc_ordera_menu_product_count(v_row.menu);
  v_hash := encode(digest(convert_to(v_row.menu::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.restaurant_menu_backups (
    restaurant_user_id, menu, settings_snapshot, menu_revision,
    product_count, content_hash, reason, created_by_user_id
  ) values (
    v_user_id, v_row.menu, coalesce(v_row.settings, '{}'::jsonb),
    v_row.menu_revision, v_count, v_hash, 'explicit_secure_clear', v_user_id
  ) on conflict (restaurant_user_id, menu_revision, content_hash)
  do update set reason = 'explicit_secure_clear'
  returning id into v_backup_id;

  perform set_config('rc_ordera.allow_menu_clear', 'on', true);
  perform set_config('rc_ordera.menu_backup_reason', 'explicit_secure_clear', true);
  update public.app_settings s set menu = '{}'::jsonb where s.user_id = v_user_id returning * into v_row;

  insert into public.platform_audit_logs (
    actor_user_id, actor_role, action, entity_type, restaurant_user_id,
    before_data, after_data, metadata
  ) values (
    v_user_id, 'restaurant_owner', 'secure_menu_clear', 'app_settings', v_user_id,
    jsonb_build_object('menuRevision', v_row.menu_revision - 1, 'productCount', v_count, 'backupId', v_backup_id),
    jsonb_build_object('menuRevision', v_row.menu_revision, 'productCount', 0),
    jsonb_build_object('confirmation', 'VACIAR MENU')
  );

  return jsonb_build_object(
    'backupId', v_backup_id,
    'menu', v_row.menu,
    'menuRevision', v_row.menu_revision,
    'productCount', 0
  );
end;
$$;

revoke all on function public.rc_ordera_menu_product_count(jsonb) from public;
revoke all on function public.rc_ordera_current_user_can_own_restaurant() from public;
revoke all on function public.save_current_restaurant_menu(jsonb, bigint) from public;
revoke all on function public.save_current_restaurant_settings(jsonb, jsonb, bigint) from public;
revoke all on function public.clear_current_restaurant_menu(text) from public;

grant execute on function public.rc_ordera_menu_product_count(jsonb) to authenticated;
grant execute on function public.rc_ordera_current_user_can_own_restaurant() to authenticated;
grant execute on function public.save_current_restaurant_menu(jsonb, bigint) to authenticated;
grant execute on function public.save_current_restaurant_settings(jsonb, jsonb, bigint) to authenticated;
grant execute on function public.clear_current_restaurant_menu(text) to authenticated;

notify pgrst, 'reload schema';
commit;

-- Rollback funcional no destructivo:
-- 1. El frontend puede volver a save_current_restaurant_state si se retira V85.
-- 2. Para desactivar el bloqueo, eliminar solo el trigger rc_ordera_protect_app_settings_trigger.
-- 3. No se recomienda borrar columnas ni respaldos creados por esta migracion.
