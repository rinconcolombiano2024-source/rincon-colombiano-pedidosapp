-- RC ORDERA V88.01
-- Repara de forma idempotente la proyeccion publica del menu por restaurante.
-- No elimina tablas, usuarios, restaurantes, productos ni pedidos.

begin;

do $preflight$
begin
  if to_regclass('public.app_settings') is null
     or to_regclass('public.restaurant_profiles') is null then
    raise exception 'Falta la estructura base de restaurantes y menus de RC ORDERA.';
  end if;
  if to_regprocedure('public.save_current_restaurant_menu(jsonb,bigint)') is null then
    raise exception 'Falta save_current_restaurant_menu(jsonb,bigint). Ejecuta primero MIGRACION-V85-01-PROTEGER-MENU-Y-AJUSTES.sql.';
  end if;
  if to_regprocedure('public.restaurant_schedule_is_open(jsonb,text,timestamptz)') is null then
    raise exception 'Falta restaurant_schedule_is_open(jsonb,text,timestamptz). Ejecuta primero la migracion V75.';
  end if;
end;
$preflight$;

create table if not exists public.restaurant_public_catalogs (
  restaurant_user_id uuid primary key references auth.users(id) on delete cascade,
  menu jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  menu_revision bigint not null default 1,
  settings_revision bigint not null default 1,
  menu_updated_at timestamptz not null default now(),
  settings_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurant_public_catalogs
  add column if not exists menu jsonb default '{}'::jsonb,
  add column if not exists settings jsonb default '{}'::jsonb,
  add column if not exists menu_revision bigint default 1,
  add column if not exists settings_revision bigint default 1,
  add column if not exists menu_updated_at timestamptz default now(),
  add column if not exists settings_updated_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.restaurant_public_catalogs
set
  menu = coalesce(menu, '{}'::jsonb),
  settings = coalesce(settings, '{}'::jsonb),
  menu_revision = greatest(coalesce(menu_revision, 1), 1),
  settings_revision = greatest(coalesce(settings_revision, 1), 1),
  menu_updated_at = coalesce(menu_updated_at, now()),
  settings_updated_at = coalesce(settings_updated_at, now()),
  updated_at = coalesce(updated_at, now())
where menu is null
   or settings is null
   or menu_revision is null
   or settings_revision is null
   or menu_updated_at is null
   or settings_updated_at is null
   or updated_at is null;

alter table public.restaurant_public_catalogs
  alter column menu set not null,
  alter column settings set not null,
  alter column menu_revision set not null,
  alter column settings_revision set not null,
  alter column menu_updated_at set not null,
  alter column settings_updated_at set not null,
  alter column updated_at set not null;

create or replace function public.rc_ordera_public_restaurant_settings(p_settings jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'businessName', p_settings->'businessName',
    'businessLogoUrl', p_settings->'businessLogoUrl',
    'currencySymbol', p_settings->'currencySymbol',
    'currencyPosition', p_settings->'currencyPosition',
    'moneyFormat', p_settings->'moneyFormat',
    'deliveryFee', p_settings->'deliveryFee',
    'deliveryMinimumFee', p_settings->'deliveryMinimumFee',
    'restaurantAddress', p_settings->'restaurantAddress',
    'restaurantOperationalOpen', p_settings->'restaurantOperationalOpen',
    'restaurantOperationalMode', p_settings->'restaurantOperationalMode',
    'openingHours', p_settings->'openingHours',
    'restaurantLatitude', p_settings->'restaurantLatitude',
    'restaurantLongitude', p_settings->'restaurantLongitude',
    'restaurantCountryCode', p_settings->'restaurantCountryCode',
    'restaurantCity', p_settings->'restaurantCity',
    'restaurantRegion', p_settings->'restaurantRegion',
    'restaurantPostalCode', p_settings->'restaurantPostalCode',
    'restaurantTimezone', p_settings->'restaurantTimezone',
    'restaurantPreferredLanguage', p_settings->'restaurantPreferredLanguage',
    'googleMapsApiKey', p_settings->'googleMapsApiKey',
    'bankAccount', p_settings->'bankAccount',
    'bankTransferNote', p_settings->'bankTransferNote',
    'onlinePaymentProvider', p_settings->'onlinePaymentProvider',
    'onlinePaymentNote', p_settings->'onlinePaymentNote'
  ));
$$;

create or replace function public.rc_ordera_sync_public_restaurant_catalog()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.restaurant_public_catalogs c
    where c.restaurant_user_id = old.user_id;
    return old;
  end if;

  insert into public.restaurant_public_catalogs (
    restaurant_user_id,
    menu,
    settings,
    menu_revision,
    settings_revision,
    menu_updated_at,
    settings_updated_at,
    updated_at
  ) values (
    new.user_id,
    coalesce(new.menu, '{}'::jsonb),
    public.rc_ordera_public_restaurant_settings(coalesce(new.settings, '{}'::jsonb)),
    greatest(coalesce(new.menu_revision, 1), 1),
    greatest(coalesce(new.settings_revision, 1), 1),
    coalesce(new.menu_updated_at, now()),
    coalesce(new.settings_updated_at, now()),
    now()
  )
  on conflict (restaurant_user_id) do update set
    menu = excluded.menu,
    settings = excluded.settings,
    menu_revision = excluded.menu_revision,
    settings_revision = excluded.settings_revision,
    menu_updated_at = excluded.menu_updated_at,
    settings_updated_at = excluded.settings_updated_at,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists rc_ordera_sync_public_restaurant_catalog_trigger on public.app_settings;
drop trigger if exists rc_ordera_sync_public_restaurant_catalog_insert on public.app_settings;
create trigger rc_ordera_sync_public_restaurant_catalog_insert
after insert on public.app_settings
for each row execute function public.rc_ordera_sync_public_restaurant_catalog();

drop trigger if exists rc_ordera_sync_public_restaurant_catalog_update on public.app_settings;
create trigger rc_ordera_sync_public_restaurant_catalog_update
after update of menu, settings, menu_revision, settings_revision on public.app_settings
for each row execute function public.rc_ordera_sync_public_restaurant_catalog();

drop trigger if exists rc_ordera_sync_public_restaurant_catalog_delete on public.app_settings;
create trigger rc_ordera_sync_public_restaurant_catalog_delete
after delete on public.app_settings
for each row execute function public.rc_ordera_sync_public_restaurant_catalog();

insert into public.restaurant_public_catalogs (
  restaurant_user_id,
  menu,
  settings,
  menu_revision,
  settings_revision,
  menu_updated_at,
  settings_updated_at,
  updated_at
)
select
  s.user_id,
  coalesce(s.menu, '{}'::jsonb),
  public.rc_ordera_public_restaurant_settings(coalesce(s.settings, '{}'::jsonb)),
  greatest(coalesce(s.menu_revision, 1), 1),
  greatest(coalesce(s.settings_revision, 1), 1),
  coalesce(s.menu_updated_at, now()),
  coalesce(s.settings_updated_at, now()),
  now()
from public.app_settings s
on conflict (restaurant_user_id) do update set
  menu = excluded.menu,
  settings = excluded.settings,
  menu_revision = excluded.menu_revision,
  settings_revision = excluded.settings_revision,
  menu_updated_at = excluded.menu_updated_at,
  settings_updated_at = excluded.settings_updated_at,
  updated_at = now();

alter table public.restaurant_public_catalogs enable row level security;

drop policy if exists "Public reads active restaurant catalogs" on public.restaurant_public_catalogs;
create policy "Public reads active restaurant catalogs"
on public.restaurant_public_catalogs
for select
to anon, authenticated
using (
  restaurant_user_id = auth.uid()
  or exists (
    select 1
    from public.restaurant_profiles rp
    where rp.user_id = restaurant_public_catalogs.restaurant_user_id
      and rp.active = true
      and rp.deleted_at is null
  )
);

grant select on table public.restaurant_public_catalogs to anon, authenticated;
revoke insert, update, delete on table public.restaurant_public_catalogs from anon, authenticated;
drop policy if exists "Public read app menu settings" on public.app_settings;
revoke all on table public.app_settings from anon;

create or replace function public.get_public_restaurant_menu(p_user_id uuid)
returns table(menu jsonb, settings jsonb)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    coalesce(c.menu, '{}'::jsonb),
    jsonb_strip_nulls(
      coalesce(c.settings, '{}'::jsonb)
      || jsonb_build_object(
        'businessName', coalesce(nullif(c.settings->>'businessName', ''), nullif(rp.business_name, ''), 'Restaurante'),
        'businessLogoUrl', coalesce(nullif(c.settings->>'businessLogoUrl', ''), nullif(rp.logo_url, '')),
        'restaurantAddress', coalesce(nullif(c.settings->>'restaurantAddress', ''), nullif(rp.public_address, '')),
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
        'restaurantLongitude', rp.longitude,
        'restaurantCountryCode', rp.country_code,
        'restaurantCity', rp.city,
        'restaurantRegion', rp.region,
        'restaurantPostalCode', rp.postal_code,
        'restaurantTimezone', rp.timezone,
        'restaurantPreferredLanguage', rp.preferred_language,
        'menuRevision', c.menu_revision,
        'settingsRevision', c.settings_revision,
        'menuUpdatedAt', c.menu_updated_at,
        'settingsUpdatedAt', c.settings_updated_at
      )
    )
  from public.restaurant_public_catalogs c
  join public.restaurant_profiles rp
    on rp.user_id = c.restaurant_user_id
   and rp.active = true
   and rp.deleted_at is null
  where c.restaurant_user_id = p_user_id
  limit 1;
$$;

revoke all on function public.rc_ordera_public_restaurant_settings(jsonb) from public, anon, authenticated;
revoke all on function public.rc_ordera_sync_public_restaurant_catalog() from public, anon, authenticated;
revoke all on function public.get_public_restaurant_menu(uuid) from public;
grant execute on function public.get_public_restaurant_menu(uuid) to anon, authenticated;

alter table public.restaurant_public_catalogs replica identity full;

do $publication$
begin
  if exists (
    select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'restaurant_public_catalogs'
  ) then
    execute 'alter publication supabase_realtime add table public.restaurant_public_catalogs';
  end if;
end;
$publication$;

notify pgrst, 'reload schema';

commit;
