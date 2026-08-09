-- RC ORDERA V75
-- Estado operativo manual/automatico y verificacion reforzada de autorizaciones.
-- Migracion incremental e idempotente: no elimina tablas, usuarios, pedidos, menus ni archivos.

begin;

do $preflight$
begin
  if to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.app_settings') is null
     or to_regclass('public.customer_orders') is null
     or to_regclass('public.restaurant_staff_memberships') is null
     or to_regclass('public.restaurant_staff_invitations') is null
     or to_regclass('public.courier_profiles') is null
     or to_regclass('public.user_roles') is null then
    raise exception 'Falta la estructura base. Ejecuta primero las migraciones V72, V73 y V74.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'restaurant_profiles' and column_name = 'timezone'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'restaurant_profiles' and column_name = 'country_code'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courier_profiles' and column_name = 'reviewed_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courier_profiles' and column_name = 'reviewed_by_user_id'
  ) then
    raise exception 'Faltan columnas de V74. Ejecuta primero MIGRACION-FASE1-V74-ESTABILIZACION-APROBACIONES-UBICACION-ELIMINACION.sql.';
  end if;
end;
$preflight$;

alter table public.restaurant_profiles
  add column if not exists operational_mode text not null default 'manual';

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_profiles'::regclass
      and conname = 'restaurant_profiles_operational_mode_check'
  ) then
    alter table public.restaurant_profiles
      add constraint restaurant_profiles_operational_mode_check
      check (operational_mode in ('manual', 'schedule')) not valid;
  end if;
end;
$constraint$;

create or replace function public.restaurant_schedule_is_open(
  p_opening_hours jsonb,
  p_timezone text,
  p_at timestamptz
)
returns boolean
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'UTC');
  v_local timestamp without time zone;
  v_iso_day integer;
  v_today_key text;
  v_previous_key text;
  v_today jsonb;
  v_previous jsonb;
  v_today_open time;
  v_today_close time;
  v_previous_open time;
  v_previous_close time;
  v_current_time time;
  v_day_keys text[] := array[
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];
begin
  begin
    v_local := timezone(v_timezone, coalesce(p_at, now()));
  exception when invalid_parameter_value then
    v_local := timezone('UTC', coalesce(p_at, now()));
  end;

  v_iso_day := extract(isodow from v_local)::integer;
  v_today_key := v_day_keys[v_iso_day];
  v_previous_key := v_day_keys[case when v_iso_day = 1 then 7 else v_iso_day - 1 end];
  v_today := coalesce(p_opening_hours, '{}'::jsonb)->v_today_key;
  v_previous := coalesce(p_opening_hours, '{}'::jsonb)->v_previous_key;
  v_current_time := v_local::time;

  if lower(coalesce(v_today->>'enabled', 'false')) in ('true', '1', 'yes')
     and coalesce(v_today->>'open', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     and coalesce(v_today->>'close', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    v_today_open := (v_today->>'open')::time;
    v_today_close := (v_today->>'close')::time;

    if v_today_open < v_today_close
       and v_current_time >= v_today_open
       and v_current_time < v_today_close then
      return true;
    end if;

    if v_today_open > v_today_close and v_current_time >= v_today_open then
      return true;
    end if;
  end if;

  if lower(coalesce(v_previous->>'enabled', 'false')) in ('true', '1', 'yes')
     and coalesce(v_previous->>'open', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     and coalesce(v_previous->>'close', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    v_previous_open := (v_previous->>'open')::time;
    v_previous_close := (v_previous->>'close')::time;

    if v_previous_open > v_previous_close and v_current_time < v_previous_close then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.apply_restaurant_schedule_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_timezone text;
begin
  if new.active is not true or new.deleted_at is not null then
    new.operational_open := false;
  elsif new.operational_mode = 'schedule' then
    v_timezone := coalesce(
      nullif(trim(new.timezone), ''),
      case upper(trim(coalesce(new.country_code, '')))
        when 'PL' then 'Europe/Warsaw'
        when 'CO' then 'America/Bogota'
        else 'UTC'
      end
    );
    new.operational_open := public.restaurant_schedule_is_open(new.opening_hours, v_timezone, now());
  end if;
  return new;
end;
$$;

drop trigger if exists apply_restaurant_schedule_state_trigger on public.restaurant_profiles;
create trigger apply_restaurant_schedule_state_trigger
before insert or update on public.restaurant_profiles
for each row execute function public.apply_restaurant_schedule_state();

create or replace function public.set_current_restaurant_operational_open(p_open boolean)
returns table (
  restaurant_user_id uuid,
  operational_open boolean,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = v_user_id and rp.active = true and rp.deleted_at is null
  ) then raise exception 'Active restaurant not found'; end if;

  update public.restaurant_profiles
  set operational_mode = 'manual',
      operational_open = coalesce(p_open, false),
      updated_at = now()
  where user_id = v_user_id;

  update public.app_settings
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'restaurantOperationalMode', 'manual',
        'restaurantOperationalOpen', coalesce(p_open, false)
      ),
      updated_at = now()
  where user_id = v_user_id;

  return query
  select rp.user_id, rp.operational_open, rp.updated_at
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;
end;
$$;

create or replace function public.set_current_restaurant_operational_mode(p_mode text)
returns table (
  restaurant_user_id uuid,
  operational_mode text,
  operational_open boolean,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_mode text := lower(trim(coalesce(p_mode, '')));
  v_open boolean;
  v_timezone text;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if v_mode not in ('manual', 'schedule') then raise exception 'Invalid operational mode'; end if;

  select
    case
      when v_mode = 'schedule' then public.restaurant_schedule_is_open(
        rp.opening_hours,
        coalesce(
          nullif(trim(rp.timezone), ''),
          case upper(trim(coalesce(rp.country_code, '')))
            when 'PL' then 'Europe/Warsaw'
            when 'CO' then 'America/Bogota'
            else 'UTC'
          end
        ),
        now()
      )
      else rp.operational_open
    end,
    coalesce(nullif(trim(rp.timezone), ''), 'UTC')
  into v_open, v_timezone
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id and rp.active = true and rp.deleted_at is null
  for update;

  if not found then raise exception 'Active restaurant not found'; end if;

  update public.restaurant_profiles
  set operational_mode = v_mode,
      operational_open = v_open,
      updated_at = now()
  where user_id = v_user_id;

  update public.app_settings
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'restaurantOperationalMode', v_mode,
        'restaurantOperationalOpen', v_open
      ),
      updated_at = now()
  where user_id = v_user_id;

  return query
  select rp.user_id, rp.operational_mode, rp.operational_open, rp.updated_at
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;
end;
$$;

create or replace function public.sync_current_restaurant_operational_status()
returns table (
  restaurant_user_id uuid,
  operational_mode text,
  operational_open boolean,
  evaluated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_mode text;
  v_previous_open boolean;
  v_effective_open boolean;
  v_timezone text;
  v_evaluated_at timestamptz := now();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select
    rp.operational_mode,
    rp.operational_open,
    coalesce(
      nullif(trim(rp.timezone), ''),
      case upper(trim(coalesce(rp.country_code, '')))
        when 'PL' then 'Europe/Warsaw'
        when 'CO' then 'America/Bogota'
        else 'UTC'
      end
    )
  into v_mode, v_previous_open, v_timezone
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id and rp.active = true and rp.deleted_at is null
  for update;

  if not found then raise exception 'Active restaurant not found'; end if;

  v_effective_open := case
    when v_mode = 'schedule' then public.restaurant_schedule_is_open(
      (select rp.opening_hours from public.restaurant_profiles rp where rp.user_id = v_user_id),
      v_timezone,
      v_evaluated_at
    )
    else v_previous_open
  end;

  if v_effective_open is distinct from v_previous_open then
    update public.restaurant_profiles
    set operational_open = v_effective_open, updated_at = v_evaluated_at
    where user_id = v_user_id;
  end if;

  update public.app_settings
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'restaurantOperationalMode', v_mode,
        'restaurantOperationalOpen', v_effective_open
      ),
      updated_at = case
        when settings->>'restaurantOperationalMode' is distinct from v_mode
          or lower(coalesce(settings->>'restaurantOperationalOpen', ''))
             is distinct from lower(v_effective_open::text)
        then v_evaluated_at
        else updated_at
      end
  where user_id = v_user_id
    and (
      settings->>'restaurantOperationalMode' is distinct from v_mode
      or lower(coalesce(settings->>'restaurantOperationalOpen', ''))
         is distinct from lower(v_effective_open::text)
    );

  return query select v_user_id, v_mode, v_effective_open, v_evaluated_at;
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
    where rp.active = true and rp.deleted_at is null
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
        coalesce(
          nullif(trim(r.timezone), ''),
          case upper(trim(coalesce(r.country_code, '')))
            when 'PL' then 'Europe/Warsaw'
            when 'CO' then 'America/Bogota'
            else 'UTC'
          end
        ),
        now()
      )
      else r.operational_open
    end as operational_open,
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
set search_path = pg_catalog, public
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
        'restaurantOperationalMode', rp.operational_mode,
        'restaurantOperationalOpen', case
          when rp.operational_mode = 'schedule' then public.restaurant_schedule_is_open(
            rp.opening_hours,
            coalesce(
              nullif(trim(rp.timezone), ''),
              case upper(trim(coalesce(rp.country_code, '')))
                when 'PL' then 'Europe/Warsaw'
                when 'CO' then 'America/Bogota'
                else 'UTC'
              end
            ),
            now()
          )
          else rp.operational_open
        end,
        'openingHours', rp.opening_hours,
        'restaurantLatitude', rp.latitude,
        'restaurantLongitude', rp.longitude
      )
    ) as settings
  from public.app_settings s
  join public.restaurant_profiles rp
    on rp.user_id = s.user_id and rp.active = true and rp.deleted_at is null
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
set search_path = pg_catalog, public
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
      and case
        when rp.operational_mode = 'schedule' then public.restaurant_schedule_is_open(
          rp.opening_hours,
          coalesce(
            nullif(trim(rp.timezone), ''),
            case upper(trim(coalesce(rp.country_code, '')))
              when 'PL' then 'Europe/Warsaw'
              when 'CO' then 'America/Bogota'
              else 'UTC'
            end
          ),
          now()
        )
        else rp.operational_open
      end = true
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

create or replace function public.enforce_customer_order_restaurant_open()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_open boolean := false;
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;

  select case
    when rp.operational_mode = 'schedule' then public.restaurant_schedule_is_open(
      rp.opening_hours,
      coalesce(
        nullif(trim(rp.timezone), ''),
        case upper(trim(coalesce(rp.country_code, '')))
          when 'PL' then 'Europe/Warsaw'
          when 'CO' then 'America/Bogota'
          else 'UTC'
        end
      ),
      now()
    )
    else rp.operational_open
  end
  into v_open
  from public.restaurant_profiles rp
  where rp.user_id = new.user_id and rp.active = true and rp.deleted_at is null;

  if coalesce(v_open, false) is not true then raise exception 'Restaurant is closed'; end if;
  return new;
end;
$$;

drop trigger if exists enforce_customer_order_restaurant_open_trigger on public.customer_orders;
create trigger enforce_customer_order_restaurant_open_trigger
before insert on public.customer_orders
for each row execute function public.enforce_customer_order_restaurant_open();

create or replace function public.list_current_restaurant_team()
returns table (
  record_key text,
  member_user_id uuid,
  member_email text,
  station text,
  display_name text,
  active boolean,
  pending boolean,
  updated_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  with team as (
    select
      'member:' || m.member_user_id::text || ':' || m.station as record_key,
      m.member_user_id,
      coalesce(au.email, '')::text as member_email,
      m.station,
      m.display_name,
      m.active,
      false as pending,
      m.updated_at
    from public.restaurant_staff_memberships m
    join auth.users au on au.id = m.member_user_id
    where m.restaurant_user_id = auth.uid()

    union all

    select
      'invite:' || i.email as record_key,
      null::uuid as member_user_id,
      i.email as member_email,
      i.station,
      i.display_name,
      false as active,
      true as pending,
      i.updated_at
    from public.restaurant_staff_invitations i
    where i.restaurant_user_id = auth.uid() and i.status = 'pending'
  )
  select
    t.record_key,
    t.member_user_id,
    t.member_email,
    t.station,
    t.display_name,
    t.active,
    t.pending,
    t.updated_at
  from team t
  order by t.pending desc, t.active desc, t.display_name, t.station;
$$;

create or replace function public.get_courier_review_result(p_user_id uuid)
returns table (
  profile_status text,
  role_status text,
  approved boolean,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'platform_admin'
      and ur.scope_type = 'platform'
      and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
      and ur.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Not authorized to review couriers';
  end if;

  return query
  select
    cp.status::text,
    coalesce(ur.status, '')::text,
    (cp.status = 'approved' and ur.status = 'active') as approved,
    cp.reviewed_at,
    cp.reviewed_by_user_id
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

revoke all on function public.restaurant_schedule_is_open(jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_restaurant_schedule_state() from public, anon, authenticated;
revoke all on function public.enforce_customer_order_restaurant_open() from public, anon, authenticated;
revoke all on function public.set_current_restaurant_operational_open(boolean) from public, anon;
revoke all on function public.set_current_restaurant_operational_mode(text) from public, anon;
revoke all on function public.sync_current_restaurant_operational_status() from public, anon;
revoke all on function public.list_current_restaurant_team() from public, anon;
revoke all on function public.get_courier_review_result(uuid) from public, anon;
revoke all on function public.get_public_restaurant_directory() from public;
revoke all on function public.get_public_restaurant_menu(uuid) from public;
revoke all on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) from public;

grant execute on function public.set_current_restaurant_operational_open(boolean) to authenticated;
grant execute on function public.set_current_restaurant_operational_mode(text) to authenticated;
grant execute on function public.sync_current_restaurant_operational_status() to authenticated;
grant execute on function public.list_current_restaurant_team() to authenticated;
grant execute on function public.get_courier_review_result(uuid) to authenticated;
grant execute on function public.get_public_restaurant_directory() to anon, authenticated;
grant execute on function public.get_public_restaurant_menu(uuid) to anon, authenticated;
grant execute on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) to anon, authenticated;

comment on column public.restaurant_profiles.operational_mode is
  'manual conserva el interruptor de caja; schedule calcula el estado con opening_hours y timezone.';
comment on function public.get_courier_review_result(uuid) is
  'Confirmacion administrativa del perfil y rol de un colaborador despues de aprobar o rechazar.';

do $verify$
begin
  if to_regprocedure('public.restaurant_schedule_is_open(jsonb,text,timestamptz)') is null
     or to_regprocedure('public.set_current_restaurant_operational_mode(text)') is null
     or to_regprocedure('public.sync_current_restaurant_operational_status()') is null
     or to_regprocedure('public.list_current_restaurant_team()') is null
     or to_regprocedure('public.get_courier_review_result(uuid)') is null then
    raise exception 'No se pudieron crear todas las funciones V75';
  end if;

  if has_function_privilege('anon', 'public.set_current_restaurant_operational_mode(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.sync_current_restaurant_operational_status()', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_current_restaurant_team()', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_courier_review_result(uuid)', 'EXECUTE') then
    raise exception 'El rol anon conserva permisos privados indebidos';
  end if;

  if not has_function_privilege('authenticated', 'public.set_current_restaurant_operational_mode(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.sync_current_restaurant_operational_status()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.list_current_restaurant_team()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_courier_review_result(uuid)', 'EXECUTE') then
    raise exception 'El rol authenticated no recibio los permisos V75 requeridos';
  end if;
end;
$verify$;

notify pgrst, 'reload schema';

commit;

-- Validaciones de solo lectura despues de ejecutar:
-- select user_id, business_name, operational_mode, operational_open, opening_hours, timezone
-- from public.restaurant_profiles order by updated_at desc;
-- select * from public.get_public_restaurant_directory();
-- select routine_name from information_schema.routines
-- where routine_schema = 'public' and routine_name in (
--   'set_current_restaurant_operational_mode',
--   'sync_current_restaurant_operational_status',
--   'list_current_restaurant_team',
--   'get_courier_review_result'
-- );
