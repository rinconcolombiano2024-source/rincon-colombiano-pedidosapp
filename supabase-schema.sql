create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  menu jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

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
alter table public.restaurant_profiles
  add column if not exists country_code text not null default '',
  add column if not exists region text not null default '',
  add column if not exists deleted_at timestamptz null,
  add column if not exists operational_mode text not null default 'manual',
  add column if not exists opening_hours jsonb not null default '{}'::jsonb,
  add column if not exists timezone text not null default 'Europe/Warsaw',
  add column if not exists operational_open boolean not null default true;
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
  v_previous_key := v_day_keys[
    case when v_iso_day = 1 then 7 else v_iso_day - 1 end
  ];

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

    if v_today_open > v_today_close
       and v_current_time >= v_today_open then
      return true;
    end if;
  end if;

  if lower(coalesce(v_previous->>'enabled', 'false')) in ('true', '1', 'yes')
     and coalesce(v_previous->>'open', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     and coalesce(v_previous->>'close', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then

    v_previous_open := (v_previous->>'open')::time;
    v_previous_close := (v_previous->>'close')::time;

    if v_previous_open > v_previous_close
       and v_current_time < v_previous_close then
      return true;
    end if;
  end if;

  return false;
end;
$$;
create or replace function public.rc_ordera_jsonb_numeric(
  p_value jsonb,
  p_default numeric default 0
)
returns numeric
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when trim(both '"' from coalesce(p_value::text, '')) ~ '^-?[0-9]+([.][0-9]+)?$'
      then trim(both '"' from p_value::text)::numeric
    else p_default
  end;
$$;
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

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  default_address jsonb not null default '{}'::jsonb,
  language text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  public_token text not null default encode(gen_random_bytes(16), 'hex'),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'sent', 'delivered', 'cancelled')),
  table_label text not null default '',
  customer_name text not null default '',
  order_type text not null default 'Comer en el punto',
  order_json jsonb not null default '{}'::jsonb,
  total numeric(12, 2) not null default 0,
  restaurant_order_id uuid null,
  assigned_courier_user_id uuid null references auth.users(id) on delete set null,
  courier_assignment_status text not null default 'unassigned' check (
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
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_orders
  add column if not exists canonical_status text not null default 'created',
  add column if not exists idempotency_key text null,
  add column if not exists prep_time_minutes integer null,
  add column if not exists estimated_ready_at timestamptz null,
  add column if not exists actual_ready_at timestamptz null,
  add column if not exists estimated_pickup_at timestamptz null,
  add column if not exists estimated_delivery_at timestamptz null,
  add column if not exists currency text not null default '',
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists base_delivery_fee numeric(12, 2) not null default 0,
  add column if not exists distance_fee numeric(12, 2) not null default 0,
  add column if not exists operational_adjustment numeric(12, 2) not null default 0,
  add column if not exists platform_adjustment numeric(12, 2) not null default 0,
  add column if not exists final_delivery_fee numeric(12, 2) not null default 0,
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists tip_amount numeric(12, 2) not null default 0,
  add column if not exists tip_currency text not null default '',
  add column if not exists tip_status text not null default 'not_applicable',
  add column if not exists payment_method text not null default '',
  add column if not exists payment_provider text not null default '',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists provider_reference text not null default '',
  add column if not exists payment_amount numeric(12, 2) not null default 0,
  add column if not exists payment_currency text not null default '',
  add column if not exists paid_at timestamptz null,
  add column if not exists refunded_at timestamptz null,
  add column if not exists cancelled_by uuid null references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text not null default '',
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancellation_fee numeric(12, 2) not null default 0;
create unique index if not exists customer_orders_restaurant_idempotency_idx
  on public.customer_orders (user_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';
create index if not exists customer_orders_canonical_created_idx
  on public.customer_orders (user_id, canonical_status, created_at desc);

create table if not exists public.customer_order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('customer', 'restaurant')),
  body text not null default '',
  image_data_url text not null default '',
  created_at timestamptz not null default now()
);

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
alter table public.delivery_assignments
  add column if not exists score numeric(12, 4) null,
  add column if not exists score_reason jsonb not null default '{}'::jsonb,
  add column if not exists estimated_pickup_at timestamptz null,
  add column if not exists estimated_delivery_at timestamptz null,
  add column if not exists proof_type text not null default '',
  add column if not exists proof_url text not null default '',
  add column if not exists delivery_pin_hash text not null default '',
  add column if not exists delivery_pin_verified boolean not null default false,
  add column if not exists delivered_lat numeric(10, 7) null,
  add column if not exists delivered_lng numeric(10, 7) null,
  add column if not exists delivered_at timestamptz null,
  add column if not exists distance_total_km numeric(10, 3) not null default 0,
  add column if not exists courier_earning numeric(12, 2) not null default 0,
  add column if not exists courier_earning_currency text not null default '';
create index if not exists delivery_assignments_courier_active_idx
  on public.delivery_assignments (courier_user_id, status, updated_at desc);
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders(id) on delete restrict,
  previous_status text null,
  new_status text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text not null default 'system',
  source text not null default 'database',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_order_created_idx
  on public.order_status_history (customer_order_id, created_at asc);
create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text not null default 'system',
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  restaurant_user_id uuid null references auth.users(id) on delete set null,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_logs_entity_created_idx
  on public.platform_audit_logs (entity_type, entity_id, created_at desc);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null default '',
  body text not null default '',
  reference_type text not null default '',
  reference_id uuid null,
  channels jsonb not null default '["in_app"]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists notifications_recipient_reference_unique_idx
  on public.notifications (recipient_user_id, notification_type, reference_type, reference_id)
  where reference_id is not null;

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;
create table if not exists public.courier_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  user_agent text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists courier_push_subscriptions_active_user_idx
  on public.courier_push_subscriptions (user_id, active);

create table if not exists public.delivery_quotes (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  customer_user_id uuid null references auth.users(id) on delete set null,
  token_hash text not null,
  destination_address text not null,
  destination_country_code text not null,
  destination_region text not null default '',
  destination_lat numeric(10, 7) null,
  destination_lng numeric(10, 7) null,
  distance_meters integer not null check (distance_meters > 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  distance_km numeric(10, 3) not null check (distance_km > 0),
  minimum_fee numeric(12, 2) not null default 0,
  extra_fee numeric(12, 2) not null default 0,
  fee_breakdown jsonb not null default '{}'::jsonb,
  final_fee numeric(12, 2) not null check (final_fee >= 0),
  currency text not null,
  provider text not null default 'google_routes',
  provider_reference text null,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used_at timestamptz null,
  used_by_order_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists delivery_quotes_restaurant_created_idx
  on public.delivery_quotes (restaurant_user_id, created_at desc);

create index if not exists delivery_quotes_expiry_idx
  on public.delivery_quotes (expires_at)
  where used_at is null;

alter table public.delivery_quotes enable row level security;

revoke all on table public.delivery_quotes from anon, authenticated;
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null default '',
  phone text not null default '',
  country text not null default '',
  city text not null default '',
  preferred_language text not null default 'es',
  status text not null default 'active' check (
    status in (
      'active',
      'deactivation_requested',
      'deactivated',
      'deletion_requested',
      'anonymized',
      'deleted',
      'suspended'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (
    role in (
      'customer',
      'restaurant_owner',
      'restaurant_admin',
      'restaurant_employee',
      'restaurant_courier',
      'platform_courier',
      'platform_admin'
    )
  ),
  scope_type text not null default 'platform' check (scope_type in ('platform', 'restaurant')),
  scope_id uuid not null default '00000000-0000-0000-0000-000000000000',
  status text not null default 'active' check (
    status in ('active', 'pending_review', 'inactive', 'suspended', 'revoked')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role, scope_type, scope_id)
);

create table if not exists public.courier_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  birth_date date null,
  country text not null default '',
  city text not null default '',
  address text not null default '',
  identity_document text not null default '',
  identity_document_url text not null default '',
  photo_url text not null default '',
  verification_selfie_url text not null default '',
  work_permit_url text not null default '',
  vehicle_type text not null default '',
  vehicle_plate text not null default '',
  driver_license text not null default '',
  driver_license_url text not null default '',
  insurance_info text not null default '',
  insurance_url text not null default '',
  bank_account text not null default '',
  availability jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (
    status in ('draft', 'pending_review', 'approved', 'rejected', 'suspended', 'inactive')
  ),
  terms_accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courier_profiles
  add column if not exists identity_document_url text not null default '',
  add column if not exists driver_license_url text not null default '',
  add column if not exists insurance_url text not null default '';
alter table public.courier_profiles
  add column if not exists max_active_deliveries integer not null default 1,
  add column if not exists max_batch_detour_km numeric(8, 2) not null default 0,
  add column if not exists max_batch_delay_minutes integer not null default 0;
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

create table if not exists public.account_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (
    request_type in (
      'account_deactivation',
      'account_deletion',
      'restaurant_closure',
      'restaurant_deletion',
      'courier_deactivation',
      'customer_deletion'
    )
  ),
  role_context text not null default '',
  status text not null default 'requested' check (
    status in ('requested', 'in_review', 'approved', 'rejected', 'completed', 'cancelled')
  ),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
alter table public.restaurant_profiles enable row level security;
alter table public.orders enable row level security;
alter table public.ticket_counters enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_messages enable row level security;
alter table public.courier_live_locations enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.order_status_history enable row level security;
alter table public.platform_audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.courier_push_subscriptions enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.courier_profiles enable row level security;
alter table public.account_privacy_requests enable row level security;
create or replace function public.rc_ordera_is_platform_admin(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_user_id is not null and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'platform_admin'
      and ur.scope_type = 'platform'
      and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
      and ur.status = 'active'
  );
$$;

create or replace function public.user_has_active_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = p_role
      and ur.status = 'active'
  );
$$;

create or replace function public.platform_owner_email()
returns text
language sql
immutable
as $$
  select 'pedidosapprinconcolombiano@gmail.com'::text;
$$;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users au
    join public.user_roles ur on ur.user_id = au.id
    where au.id = auth.uid()
      and lower(au.email) = lower(public.platform_owner_email())
      and ur.role = 'platform_admin'
      and ur.scope_type = 'platform'
      and ur.status = 'active'
  );
$$;

create or replace function public.activate_user_role(
  p_role text,
  p_scope_type text default 'platform',
  p_scope_id uuid default '00000000-0000-0000-0000-000000000000'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := lower(trim(coalesce(p_role, '')));
  v_scope_type text := lower(trim(coalesce(p_scope_type, 'platform')));
  v_scope_id uuid := coalesce(p_scope_id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_status text := 'active';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_role not in ('customer', 'restaurant_owner', 'platform_courier') then
    raise exception 'Role cannot be self-activated';
  end if;

  if v_scope_type not in ('platform', 'restaurant') then
    raise exception 'Invalid role scope';
  end if;

  if v_role in ('customer', 'restaurant_owner', 'platform_courier') and v_scope_type <> 'platform' then
    raise exception 'This role must use platform scope';
  end if;

  if v_role = 'platform_courier' then
    v_status := 'pending_review';
  end if;

  insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
  values (v_user_id, v_role, v_scope_type, v_scope_id, v_status, now())
  on conflict (user_id, role, scope_type, scope_id)
  do update set
    status = case
      when public.user_roles.status = 'active' then public.user_roles.status
      else excluded.status
    end,
    updated_at = now();
end;
$$;

create or replace function public.user_can_review_couriers()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.is_platform_owner();
$$;

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
security definer
set search_path = public
as $$
begin
  if not public.user_can_review_couriers() then
    raise exception 'Not authorized to review couriers';
  end if;

  return query
  select
    cp.user_id,
    au.email::text,
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
      else 4
    end,
    cp.updated_at desc;
end;
$$;

create or replace function public.review_courier_profile(
  p_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_role_status text;
begin
  if not public.user_can_review_couriers() then
    raise exception 'Not authorized to review couriers';
  end if;

  if v_status not in ('approved', 'rejected', 'suspended', 'inactive', 'pending_review') then
    raise exception 'Invalid courier status';
  end if;

  if not exists (select 1 from public.courier_profiles cp where cp.user_id = p_user_id) then
    raise exception 'Courier profile not found';
  end if;

  update public.courier_profiles
  set status = v_status,
      updated_at = now()
  where user_id = p_user_id;

  v_role_status := case v_status
    when 'approved' then 'active'
    when 'rejected' then 'revoked'
    when 'suspended' then 'suspended'
    when 'inactive' then 'inactive'
    else 'pending_review'
  end;

  insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
  values (
    p_user_id,
    'platform_courier',
    'platform',
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_role_status,
    now()
  )
  on conflict (user_id, role, scope_type, scope_id)
  do update set status = excluded.status,
                updated_at = now();
end;
$$;

drop policy if exists "Users manage own app settings" on public.app_settings;
create policy "Users manage own app settings"
on public.app_settings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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
  )
);

drop policy if exists "Public read active restaurant profiles" on public.restaurant_profiles;
create policy "Public read active restaurant profiles"
on public.restaurant_profiles
for select
using (active = true);

drop policy if exists "Restaurants manage own public profile" on public.restaurant_profiles;
create policy "Restaurants manage own public profile"
on public.restaurant_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own orders" on public.orders;
create policy "Users manage own orders"
on public.orders
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own ticket counters" on public.ticket_counters;
create policy "Users manage own ticket counters"
on public.ticket_counters
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Customers manage own profile" on public.customer_profiles;
create policy "Customers manage own profile"
on public.customer_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Customers create pending customer orders" on public.customer_orders;
create policy "Customers create pending customer orders"
on public.customer_orders
for insert
to authenticated
with check (status = 'pending' and auth.uid() = customer_user_id);

drop policy if exists "Authenticated customers create own pending customer orders" on public.customer_orders;
create policy "Authenticated customers create own pending customer orders"
on public.customer_orders
for insert
to authenticated
with check (status = 'pending' and auth.uid() = customer_user_id);

drop policy if exists "Authenticated customers read own customer orders" on public.customer_orders;
create policy "Authenticated customers read own customer orders"
on public.customer_orders
for select
to authenticated
using (auth.uid() = customer_user_id);

drop policy if exists "Users manage own customer orders" on public.customer_orders;
create policy "Users manage own customer orders"
on public.customer_orders
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own customer order messages" on public.customer_order_messages;
create policy "Users manage own customer order messages"
on public.customer_order_messages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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

drop policy if exists "Users manage own general profile" on public.user_profiles;
create policy "Users manage own general profile"
on public.user_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Platform admins manage general profiles" on public.user_profiles;
create policy "Platform admins manage general profiles"
on public.user_profiles
for all
using (public.is_platform_owner())
with check (public.is_platform_owner());

drop policy if exists "Users read own roles" on public.user_roles;
create policy "Users read own roles"
on public.user_roles
for select
using (auth.uid() = user_id);

drop policy if exists "Platform admins manage roles" on public.user_roles;
create policy "Platform admins manage roles"
on public.user_roles
for all
using (public.is_platform_owner())
with check (public.is_platform_owner());

drop policy if exists "Users manage own courier profile" on public.courier_profiles;
create policy "Users manage own courier profile"
on public.courier_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Platform admins manage courier profiles" on public.courier_profiles;
create policy "Platform admins manage courier profiles"
on public.courier_profiles
for all
using (public.is_platform_owner())
with check (public.is_platform_owner());

insert into storage.buckets (id, name, public)
values ('courier-documents', 'courier-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Couriers upload own documents" on storage.objects;
create policy "Couriers upload own documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'courier-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Couriers read own documents" on storage.objects;
create policy "Couriers read own documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'courier-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.user_can_review_couriers()
  )
);

drop policy if exists "Couriers update own documents" on storage.objects;
create policy "Couriers update own documents"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'courier-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'courier-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Couriers delete own documents" on storage.objects;
create policy "Couriers delete own documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'courier-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users create own privacy requests" on public.account_privacy_requests;
create policy "Users create own privacy requests"
on public.account_privacy_requests
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users read own privacy requests" on public.account_privacy_requests;
create policy "Users read own privacy requests"
on public.account_privacy_requests
for select
using (auth.uid() = user_id);

drop policy if exists "Platform admins manage privacy requests" on public.account_privacy_requests;
create policy "Platform admins manage privacy requests"
on public.account_privacy_requests
for all
using (public.is_platform_owner())
with check (public.is_platform_owner());

grant select on public.app_settings to anon, authenticated;
grant insert, update, delete on public.app_settings to authenticated;
grant select on public.restaurant_profiles to anon, authenticated;
grant insert, update, delete on public.restaurant_profiles to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.ticket_counters to authenticated;
grant select, insert, update, delete on public.customer_profiles to authenticated;
revoke insert on public.customer_orders from anon;
grant select, insert, update, delete on public.customer_orders to authenticated;
grant select, insert, update, delete on public.customer_order_messages to authenticated;
grant select, insert, update on public.courier_live_locations to authenticated;
grant select, insert, update on public.delivery_assignments to authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update on public.courier_profiles to authenticated;
grant select, insert on public.account_privacy_requests to authenticated;
grant execute on function public.user_has_active_role(text) to authenticated;
grant execute on function public.platform_owner_email() to authenticated;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.activate_user_role(text, text, uuid) to authenticated;
grant execute on function public.user_can_review_couriers() to authenticated;

-- V71: estacion movil de meseros y sincronizacion con caja central.
-- RC ORDERA V71
-- Estacion movil de meseros y sincronizacion segura con la caja central.
-- Migracion incremental: no elimina tablas ni pedidos existentes.

create extension if not exists pgcrypto;

alter table public.customer_orders
  add column if not exists source text not null default 'customer',
  add column if not exists created_by_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists server_name text not null default '',
  add column if not exists station_status text not null default 'received';

alter table public.customer_orders
  drop constraint if exists customer_orders_source_check;

alter table public.customer_orders
  add constraint customer_orders_source_check
  check (source in ('customer', 'waiter'));

alter table public.customer_orders
  drop constraint if exists customer_orders_station_status_check;

alter table public.customer_orders
  add constraint customer_orders_station_status_check
  check (station_status in ('received', 'preparing', 'ready', 'packed', 'dispatched', 'completed', 'cancelled'));

create index if not exists customer_orders_restaurant_source_created_idx
  on public.customer_orders (user_id, source, created_at desc);

create index if not exists customer_orders_created_by_idx
  on public.customer_orders (created_by_user_id, created_at desc)
  where created_by_user_id is not null;

create index if not exists customer_orders_station_queue_idx
  on public.customer_orders (user_id, station_status, created_at desc);

create table if not exists public.restaurant_staff_memberships (
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  station text not null default 'waiter' check (
    station in ('waiter', 'cashier', 'kitchen', 'packing', 'dispatch', 'manager')
  ),
  display_name text not null default '',
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  granted_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_user_id, member_user_id, station)
);

create index if not exists restaurant_staff_member_active_idx
  on public.restaurant_staff_memberships (member_user_id, active, restaurant_user_id);

alter table public.restaurant_staff_memberships enable row level security;
create or replace function public.rc_ordera_actor_role(
  p_order_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.customer_orders%rowtype;
  v_station text;
begin
  if p_actor_user_id is null then
    return 'system';
  end if;

  if public.rc_ordera_is_platform_admin(p_actor_user_id) then
    return 'platform_admin';
  end if;

  select co.*
  into v_order
  from public.customer_orders co
  where co.id = p_order_id;

  if not found then
    return 'authenticated';
  end if;

  if v_order.customer_user_id = p_actor_user_id then
    return 'customer';
  end if;

  if v_order.assigned_courier_user_id = p_actor_user_id then
    return 'platform_courier';
  end if;

  if v_order.user_id = p_actor_user_id then
    return 'restaurant_owner';
  end if;

  select m.station
  into v_station
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = v_order.user_id
    and m.member_user_id = p_actor_user_id
    and m.active = true
  order by m.updated_at desc
  limit 1;

  return coalesce(nullif(v_station, ''), 'authenticated');
end;
$$;
create or replace function public.rc_ordera_derive_order_status(
  p_status text,
  p_station_status text,
  p_courier_status text
)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when p_status = 'cancelled'
      or p_station_status = 'cancelled'
      or p_courier_status = 'cancelled'
      then 'cancelled'

    when p_status = 'delivered'
      or p_station_status = 'completed'
      or p_courier_status = 'delivered'
      then 'delivered'

    when p_courier_status = 'arrived_customer'
      then 'courier_arrived_customer'

    when p_courier_status = 'picked_up'
      then 'on_the_way'

    when p_courier_status = 'arrived_restaurant'
      then 'courier_arrived_restaurant'

    when p_courier_status = 'accepted'
      then 'courier_accepted'

    when p_courier_status = 'offered'
      then 'courier_offered'

    when p_station_status = 'dispatched'
      or p_status = 'sent'
      then 'on_the_way'

    when p_station_status = 'packed'
      then 'ready_for_pickup'

    when p_station_status = 'ready'
      then 'ready_for_pickup'

    when p_station_status = 'preparing'
      then 'preparing'

    when p_status = 'accepted'
      then 'accepted'

    when p_status = 'pending'
      then 'submitted'

    else 'created'
  end;
$$;
create or replace function public.rc_ordera_prepare_order_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.canonical_status := public.rc_ordera_derive_order_status(
    new.status,
    new.station_status,
    new.courier_assignment_status
  );

  if new.idempotency_key is null or trim(new.idempotency_key) = '' then
    new.idempotency_key := new.id::text;
  end if;

  return new;
end;
$$;

create or replace function public.rc_ordera_record_order_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_previous text := case when tg_op = 'INSERT' then null else old.canonical_status end;
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' or v_previous is distinct from new.canonical_status then
    insert into public.order_status_history (
      customer_order_id,
      previous_status,
      new_status,
      actor_user_id,
      actor_role,
      source,
      metadata
    )
    values (
      new.id,
      v_previous,
      new.canonical_status,
      v_actor,
      public.rc_ordera_actor_role(new.id, v_actor),
      case when v_actor is null then 'database' else 'application' end,
      jsonb_build_object(
        'legacy_status', new.status,
        'station_status', new.station_status,
        'courier_status', new.courier_assignment_status
      )
    );
  end if;

  return new;
end;
$$;

create or replace function public.rc_ordera_can_access_order(
  p_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and (
    public.rc_ordera_is_platform_admin(auth.uid())
    or exists (
      select 1
      from public.customer_orders co
      where co.id = p_order_id
        and (
          co.user_id = auth.uid()
          or co.customer_user_id = auth.uid()
          or co.assigned_courier_user_id = auth.uid()
          or exists (
            select 1
            from public.restaurant_staff_memberships m
            where m.restaurant_user_id = co.user_id
              and m.member_user_id = auth.uid()
              and m.active = true
          )
        )
    )
  );
$$;

create or replace function public.set_courier_availability(
  p_available boolean
)
returns table(
  available boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
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
      raise exception 'Courier profile is not approved';
    end if;

    update public.courier_live_locations cl
    set available = true,
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
        updated_at = now()
    where cl.user_id = v_user_id;
  end if;

  return query
  select
    coalesce(cl.available, false),
    coalesce(cl.updated_at, now())
  from (select 1) seed
  left join public.courier_live_locations cl
    on cl.user_id = v_user_id;
end;
$$;

create or replace function public.rc_ordera_delivery_fee_breakdown(
  p_distance_km numeric,
  p_minimum_fee numeric,
  p_extra_fee numeric
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_distance numeric := greatest(coalesce(p_distance_km, 0), 0);
  v_raw numeric := 0;
  v_base numeric := 0;
  v_distance_fee numeric := 0;
  v_before_extra numeric := 0;
  v_operational numeric := 0;
  v_extra numeric := greatest(coalesce(p_extra_fee, 0), 0);
  v_final numeric := 0;
begin
  if v_distance <= 0 then
    return jsonb_build_object(
      'base', 0,
      'distance', 0,
      'operational', 0,
      'platform', 0,
      'final', 0
    );
  end if;

  v_base := 4.50;
  v_raw := v_base;

  if v_distance > 1.5 then
    v_raw := v_raw + (least(v_distance, 6.0) - 1.5) * 1.50;
  end if;

  if v_distance > 6.0 then
    v_raw := v_raw + (least(v_distance, 8.0) - 6.0) * 2.50;
  end if;

  if v_distance > 8.0 then
    v_raw := v_raw + (v_distance - 8.0) * 3.50;
  end if;

  v_raw := round(v_raw, 2);
  v_distance_fee := round(greatest(v_raw - v_base, 0), 2);
  v_before_extra := round(
    greatest(
      greatest(coalesce(p_minimum_fee, 20), 0),
      v_raw * 1.6714285714
    ),
    2
  );
  v_operational := round(v_before_extra - v_raw, 2);
  v_final := round(v_before_extra + v_extra, 2);

  return jsonb_build_object(
    'base', v_base,
    'distance', v_distance_fee,
    'operational', v_operational,
    'platform', round(v_extra, 2),
    'final', v_final
  );
end;
$$;

create or replace function public.rc_ordera_notify_delivery_offer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'offered' then
    insert into public.notifications (
      recipient_user_id,
      notification_type,
      title,
      body,
      reference_type,
      reference_id,
      channels,
      payload
    )
    values (
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
        'url', './colaborador.html?view=offers'
      )
    )
    on conflict (
      recipient_user_id,
      notification_type,
      reference_type,
      reference_id
    )
    where reference_id is not null
    do update set
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
after insert or update of status
on public.delivery_assignments
for each row
when (new.status = 'offered')
execute function public.rc_ordera_notify_delivery_offer();
-- ============================================================
-- V82 - NORMALIZACION DE ESTADO, TRIGGERS Y ACCESO
-- ============================================================

update public.customer_orders co
set canonical_status = public.rc_ordera_derive_order_status(
      co.status,
      co.station_status,
      co.courier_assignment_status
    ),
    idempotency_key = coalesce(
      nullif(co.idempotency_key, ''),
      co.id::text
    )
where co.canonical_status is distinct from
      public.rc_ordera_derive_order_status(
        co.status,
        co.station_status,
        co.courier_assignment_status
      )
   or co.idempotency_key is null
   or co.idempotency_key = '';

alter table public.customer_orders
  drop constraint if exists customer_orders_canonical_status_check;

alter table public.customer_orders
  add constraint customer_orders_canonical_status_check
  check (
    canonical_status in (
      'created',
      'submitted',
      'restaurant_review',
      'accepted',
      'rejected',
      'preparing',
      'ready_for_pickup',
      'courier_searching',
      'courier_offered',
      'courier_accepted',
      'courier_arrived_restaurant',
      'picked_up',
      'on_the_way',
      'courier_arrived_customer',
      'delivered',
      'cancelled',
      'failed',
      'refunded'
    )
  );

drop trigger if exists rc_ordera_prepare_order_status_trigger
on public.customer_orders;

create trigger rc_ordera_prepare_order_status_trigger
before insert or update of
  status,
  station_status,
  courier_assignment_status,
  canonical_status,
  idempotency_key
on public.customer_orders
for each row
execute function public.rc_ordera_prepare_order_status();

drop trigger if exists rc_ordera_record_order_status_trigger
on public.customer_orders;

create trigger rc_ordera_record_order_status_trigger
after insert or update of canonical_status
on public.customer_orders
for each row
execute function public.rc_ordera_record_order_status();


drop policy if exists "Authorized users read order status history"
on public.order_status_history;

create policy "Authorized users read order status history"
on public.order_status_history
for select
to authenticated
using (
  public.rc_ordera_can_access_order(customer_order_id)
);


drop policy if exists "Platform admins read audit logs"
on public.platform_audit_logs;

create policy "Platform admins read audit logs"
on public.platform_audit_logs
for select
to authenticated
using (
  public.rc_ordera_is_platform_admin(auth.uid())
);


drop policy if exists "Users read own notifications"
on public.notifications;

create policy "Users read own notifications"
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
);


drop policy if exists "Users update own notifications"
on public.notifications;

create policy "Users update own notifications"
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
)
with check (
  recipient_user_id = auth.uid()
);


drop policy if exists "Couriers manage own push subscriptions"
on public.courier_push_subscriptions;

create policy "Couriers manage own push subscriptions"
on public.courier_push_subscriptions
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.courier_profiles cp
    join public.user_roles ur
      on ur.user_id = cp.user_id
     and ur.role = 'platform_courier'
     and ur.scope_type = 'platform'
     and ur.scope_id =
       '00000000-0000-0000-0000-000000000000'::uuid
     and ur.status = 'active'
    where cp.user_id = auth.uid()
      and cp.status = 'approved'
  )
);

drop policy if exists "Restaurant owners read own staff" on public.restaurant_staff_memberships;
create policy "Restaurant owners read own staff"
on public.restaurant_staff_memberships
for select
to authenticated
using (auth.uid() = restaurant_user_id);

drop policy if exists "Staff read own memberships" on public.restaurant_staff_memberships;
create policy "Staff read own memberships"
on public.restaurant_staff_memberships
for select
to authenticated
using (auth.uid() = member_user_id);

drop policy if exists "Staff read submitted station orders" on public.customer_orders;
create policy "Staff read submitted station orders"
on public.customer_orders
for select
to authenticated
using (auth.uid() = created_by_user_id);

drop policy if exists "Operational stations read active restaurant orders" on public.customer_orders;
create policy "Operational stations read active restaurant orders"
on public.customer_orders
for select
to authenticated
using (
  status in ('accepted', 'sent')
  and exists (
    select 1
    from public.restaurant_staff_memberships m
    join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
    where m.restaurant_user_id = customer_orders.user_id
      and m.member_user_id = auth.uid()
      and m.station in ('cashier', 'kitchen', 'packing', 'dispatch', 'manager')
      and m.active = true
      and rp.active = true
  )
);

create or replace function public.grant_current_restaurant_staff(
  p_email text,
  p_station text default 'waiter',
  p_display_name text default ''
)
returns table (
  member_user_id uuid,
  member_email text,
  station text,
  display_name text,
  active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_member_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_station text := lower(trim(coalesce(p_station, 'waiter')));
  v_display_name text := left(trim(coalesce(p_display_name, '')), 100);
begin
  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.restaurant_profiles rp
    join public.app_settings s on s.user_id = rp.user_id
    where rp.user_id = v_owner_id
      and rp.active = true
  ) then
    raise exception 'Restaurant owner profile is missing';
  end if;

  if v_station not in ('waiter', 'cashier', 'kitchen', 'packing', 'dispatch', 'manager') then
    raise exception 'Invalid station';
  end if;

  if v_email = '' then
    raise exception 'Employee email is required';
  end if;

  select au.id
  into v_member_id
  from auth.users au
  where lower(au.email) = v_email
  limit 1;

  if v_member_id is null then
    raise exception 'Employee account was not found';
  end if;

  update public.restaurant_staff_memberships
  set active = false, updated_at = now()
  where restaurant_user_id = v_owner_id
    and member_user_id = v_member_id
    and station <> v_station
    and active = true;

  insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
  values (v_member_id, 'restaurant_employee', 'restaurant', v_owner_id, 'active', now())
  on conflict (user_id, role, scope_type, scope_id)
  do update set status = 'active', updated_at = now();

  insert into public.restaurant_staff_memberships (
    restaurant_user_id,
    member_user_id,
    station,
    display_name,
    permissions,
    active,
    granted_by_user_id,
    updated_at
  )
  values (
    v_owner_id,
    v_member_id,
    v_station,
    coalesce(nullif(v_display_name, ''), split_part(v_email, '@', 1)),
    case
      when v_station in ('waiter', 'cashier', 'manager') then '{"create_orders":true}'::jsonb
      else '{}'::jsonb
    end,
    true,
    v_owner_id,
    now()
  )
  on conflict (restaurant_user_id, member_user_id, station)
  do update set
    display_name = excluded.display_name,
    permissions = excluded.permissions,
    active = true,
    granted_by_user_id = v_owner_id,
    updated_at = now();

  return query
  select
    m.member_user_id,
    coalesce(au.email, '')::text,
    m.station,
    m.display_name,
    m.active
  from public.restaurant_staff_memberships m
  join auth.users au on au.id = m.member_user_id
  where m.restaurant_user_id = v_owner_id
    and m.member_user_id = v_member_id
    and m.station = v_station;
end;
$$;

create or replace function public.list_current_restaurant_staff()
returns table (
  member_user_id uuid,
  member_email text,
  station text,
  display_name text,
  active boolean,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    m.member_user_id,
    coalesce(au.email, '')::text,
    m.station,
    m.display_name,
    m.active,
    m.updated_at
  from public.restaurant_staff_memberships m
  join auth.users au on au.id = m.member_user_id
  where m.restaurant_user_id = auth.uid()
  order by m.active desc, m.display_name, m.station;
$$;

create or replace function public.set_current_restaurant_staff_active(
  p_member_user_id uuid,
  p_station text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_station text := lower(trim(coalesce(p_station, '')));
begin
  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.restaurant_staff_memberships
  set active = coalesce(p_active, false), updated_at = now()
  where restaurant_user_id = v_owner_id
    and member_user_id = p_member_user_id
    and station = v_station;

  if not found then
    raise exception 'Staff membership was not found';
  end if;

  if coalesce(p_active, false) = false
     and not exists (
       select 1
       from public.restaurant_staff_memberships m
       where m.restaurant_user_id = v_owner_id
         and m.member_user_id = p_member_user_id
         and m.active = true
     ) then
    update public.user_roles
    set status = 'revoked', updated_at = now()
    where user_id = p_member_user_id
      and role = 'restaurant_employee'
      and scope_type = 'restaurant'
      and scope_id = v_owner_id;
  elsif coalesce(p_active, false) = true then
    insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
    values (p_member_user_id, 'restaurant_employee', 'restaurant', v_owner_id, 'active', now())
    on conflict (user_id, role, scope_type, scope_id)
    do update set status = 'active', updated_at = now();
  end if;
end;
$$;

create or replace function public.get_my_restaurant_station(p_restaurant_user_id uuid)
returns table (
  restaurant_user_id uuid,
  station text,
  display_name text,
  permissions jsonb,
  business_name text,
  logo_url text,
  active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    m.restaurant_user_id,
    m.station,
    m.display_name,
    m.permissions,
    coalesce(nullif(rp.business_name, ''), 'Restaurante')::text,
    coalesce(rp.logo_url, '')::text,
    m.active
  from public.restaurant_staff_memberships m
  join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = auth.uid()
    and m.active = true
    and rp.active = true
  order by case m.station when 'manager' then 1 when 'cashier' then 2 when 'waiter' then 3 else 4 end
  limit 1;
$$;

create or replace function public.submit_waiter_order(
  p_id uuid,
  p_restaurant_user_id uuid,
  p_table_label text,
  p_customer_name text,
  p_order_type text,
  p_payment_method text,
  p_notes text,
  p_items jsonb
)
returns table (id uuid, total numeric, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid := auth.uid();
  v_membership public.restaurant_staff_memberships%rowtype;
  v_menu jsonb;
  v_item jsonb;
  v_product jsonb;
  v_category record;
  v_candidate jsonb;
  v_product_id text;
  v_quantity integer;
  v_price numeric(12,2);
  v_total numeric(12,2) := 0;
  v_validated_items jsonb := '[]'::jsonb;
  v_order_json jsonb;
  v_order_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;

  select m.*
  into v_membership
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = v_member_id
    and m.station in ('waiter', 'cashier', 'manager')
    and m.active = true
    and coalesce((m.permissions->>'create_orders')::boolean, false) = true
  order by case m.station when 'manager' then 1 when 'cashier' then 2 else 3 end
  limit 1;

  if not found then
    raise exception 'Waiter is not authorized for this restaurant';
  end if;

  if not exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = p_restaurant_user_id and rp.active = true
  ) then
    raise exception 'Restaurant is not active';
  end if;

  select coalesce(s.menu, '{}'::jsonb)
  into v_menu
  from public.app_settings s
  where s.user_id = p_restaurant_user_id;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Order has no items';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product := null;
    v_product_id := trim(coalesce(v_item->>'productId', v_item->>'product_id', ''));
    v_quantity := greatest(
      1,
      least(
        99,
        case
          when coalesce(v_item->>'qty', v_item->>'quantity', '') ~ '^[0-9]+$'
            then coalesce(v_item->>'qty', v_item->>'quantity')::integer
          else 1
        end
      )
    );

    for v_category in select key, value from jsonb_each(v_menu)
    loop
      if jsonb_typeof(v_category.value) = 'array' then
        select product.value
        into v_candidate
        from jsonb_array_elements(v_category.value) as product(value)
        where (
          v_product_id <> '' and trim(coalesce(product.value->>'id', product.value->>'productId', '')) = v_product_id
        )
        or (
          v_product_id = '' and lower(trim(product.value->>'name')) = lower(trim(v_item->>'name'))
        )
        limit 1;
        if v_candidate is not null then
          v_product := v_candidate;
          exit;
        end if;
      end if;
    end loop;

    if v_product is null then
      raise exception 'Menu product was not found';
    end if;
    if coalesce((v_product->>'available')::boolean, true) = false then
      raise exception 'Menu product is unavailable';
    end if;

    v_price := greatest(0, round(coalesce((v_product->>'price')::numeric, 0), 2));
    v_total := v_total + (v_price * v_quantity);
    v_validated_items := v_validated_items || jsonb_build_array(
      jsonb_build_object(
        'productId', coalesce(nullif(v_product->>'id', ''), v_product_id),
        'product_id', coalesce(nullif(v_product->>'id', ''), v_product_id),
        'name', coalesce(v_product->>'name', ''),
        'product_name_snapshot', coalesce(v_product->>'name', ''),
        'price', v_price,
        'unit_price_snapshot', v_price,
        'qty', v_quantity,
        'quantity', v_quantity,
        'total_snapshot', v_price * v_quantity,
        'note', upper(left(trim(coalesce(v_item->>'note', '')), 500))
      )
    );
  end loop;

  v_order_json := jsonb_build_object(
    'source', 'waiter',
    'serverName', v_membership.display_name,
    'type', coalesce(nullif(trim(p_order_type), ''), 'Comer en el punto'),
    'paymentMethod', coalesce(nullif(trim(p_payment_method), ''), 'Pago en caja'),
    'notes', upper(left(trim(coalesce(p_notes, '')), 1000)),
    'items', v_validated_items
  );

  insert into public.customer_orders (
    id,
    user_id,
    customer_user_id,
    status,
    table_label,
    customer_name,
    order_type,
    order_json,
    total,
    source,
    created_by_user_id,
    server_name,
    created_at,
    updated_at
  )
  values (
    v_order_id,
    p_restaurant_user_id,
    null,
    'pending',
    left(trim(coalesce(p_table_label, '')), 120),
    left(trim(coalesce(p_customer_name, '')), 120),
    coalesce(nullif(trim(p_order_type), ''), 'Comer en el punto'),
    v_order_json,
    v_total,
    'waiter',
    v_member_id,
    v_membership.display_name,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return query
  select co.id, co.total, co.created_at
  from public.customer_orders co
  where co.id = v_order_id
    and co.created_by_user_id = v_member_id
    and co.user_id = p_restaurant_user_id;
end;
$$;

create or replace function public.list_my_station_orders(p_restaurant_user_id uuid)
returns table (
  order_id uuid,
  order_status text,
  station_status text,
  table_label text,
  customer_name text,
  order_type text,
  items jsonb,
  notes text,
  source text,
  server_name text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid := auth.uid();
begin
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.restaurant_staff_memberships m
    join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
    where m.restaurant_user_id = p_restaurant_user_id
      and m.member_user_id = v_member_id
      and m.active = true
      and rp.active = true
  ) then
    raise exception 'Station is not authorized';
  end if;

  return query
  select
    co.id,
    co.status,
    co.station_status,
    co.table_label,
    co.customer_name,
    co.order_type,
    coalesce(co.order_json->'items', '[]'::jsonb),
    upper(left(coalesce(co.order_json->>'notes', ''), 1000)),
    co.source,
    co.server_name,
    co.created_at,
    co.updated_at
  from public.customer_orders co
  where co.user_id = p_restaurant_user_id
    and co.status in ('accepted', 'sent')
    and co.station_status not in ('completed', 'cancelled')
    and co.created_at >= now() - interval '36 hours'
  order by co.created_at asc
  limit 100;
end;
$$;

create or replace function public.update_my_station_order(
  p_restaurant_user_id uuid,
  p_order_id uuid,
  p_next_station_status text
)
returns table (
  order_id uuid,
  order_status text,
  station_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid := auth.uid();
  v_station text;
  v_next text := lower(trim(coalesce(p_next_station_status, '')));
  v_current text;
  v_order_status text;
  v_allowed boolean := false;
begin
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;

  select m.station
  into v_station
  from public.restaurant_staff_memberships m
  join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = v_member_id
    and m.active = true
    and rp.active = true
  order by case m.station
    when 'manager' then 1
    when 'cashier' then 2
    when 'kitchen' then 3
    when 'packing' then 4
    when 'dispatch' then 5
    else 6
  end
  limit 1;

  if v_station is null then
    raise exception 'Station is not authorized';
  end if;

  select co.station_status, co.status
  into v_current, v_order_status
  from public.customer_orders co
  where co.id = p_order_id
    and co.user_id = p_restaurant_user_id
  for update;

  if not found or v_order_status not in ('accepted', 'sent') then
    raise exception 'Order is not active';
  end if;

  if v_station in ('manager', 'cashier') then
    v_allowed := v_next in ('received', 'preparing', 'ready', 'packed', 'dispatched', 'completed', 'cancelled');
  elsif v_station = 'kitchen' then
    v_allowed := v_next in ('preparing', 'ready')
      and v_current in ('received', 'preparing');
  elsif v_station = 'packing' then
    v_allowed := v_next = 'packed'
      and v_current in ('received', 'preparing', 'ready');
  elsif v_station = 'dispatch' then
    v_allowed := (v_next = 'dispatched' and v_current in ('received', 'preparing', 'ready', 'packed'))
      or (v_next = 'completed' and v_current in ('ready', 'packed', 'dispatched'));
  end if;

  if not v_allowed then
    raise exception 'Station transition is not allowed';
  end if;

  update public.customer_orders co
  set
    station_status = v_next,
    status = case
      when v_next = 'dispatched' then 'sent'
      when v_next = 'completed' then 'delivered'
      when v_next = 'cancelled' then 'cancelled'
      else co.status
    end,
    updated_at = now()
  where co.id = p_order_id
    and co.user_id = p_restaurant_user_id;

  return query
  select co.id, co.status, co.station_status, co.updated_at
  from public.customer_orders co
  where co.id = p_order_id
    and co.user_id = p_restaurant_user_id;
end;
$$;

grant select on public.restaurant_staff_memberships to authenticated;
grant execute on function public.grant_current_restaurant_staff(text, text, text) to authenticated;
grant execute on function public.list_current_restaurant_staff() to authenticated;
grant execute on function public.set_current_restaurant_staff_active(uuid, text, boolean) to authenticated;
grant execute on function public.get_my_restaurant_station(uuid) to authenticated;
grant execute on function public.submit_waiter_order(uuid, uuid, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.list_my_station_orders(uuid) to authenticated;
grant execute on function public.update_my_station_order(uuid, uuid, text) to authenticated;

alter table public.customer_orders replica identity full;
alter table public.restaurant_profiles replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_orders'
  ) then
    alter publication supabase_realtime add table public.customer_orders;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'restaurant_profiles'
  ) then
    alter publication supabase_realtime add table public.restaurant_profiles;
  end if;
end
$$;
grant execute on function public.get_courier_review_queue() to authenticated;
grant execute on function public.review_courier_profile(uuid, text) to authenticated;
grant execute on function public.distance_km(numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.parse_lat_lng(text) to authenticated;
grant execute on function public.upsert_courier_live_location(boolean, numeric, numeric, integer) to authenticated;
grant execute on function public.assign_nearest_courier(uuid) to authenticated;
grant execute on function public.get_courier_delivery_offers() to authenticated;
grant execute on function public.update_delivery_assignment_status(uuid, text) to authenticated;

update public.user_roles
set status = 'revoked',
    updated_at = now()
where role = 'platform_admin'
  and user_id not in (
    select au.id
    from auth.users au
    where lower(au.email) = lower(public.platform_owner_email())
  );

insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
select
  au.id,
  'platform_admin',
  'platform',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'active',
  now()
from auth.users au
where lower(au.email) = lower(public.platform_owner_email())
on conflict (user_id, role, scope_type, scope_id)
do update set status = 'active',
              updated_at = now();

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

create index if not exists restaurant_profiles_active_name_idx
on public.restaurant_profiles (active, business_name);

create index if not exists restaurant_profiles_active_business_name_idx
on public.restaurant_profiles (active, lower(trim(business_name)));

insert into public.restaurant_profiles (
  user_id,
  business_name,
  logo_url,
  public_address,
  phone,
  description,
  active,
  updated_at
)
select
  s.user_id,
  coalesce(nullif(s.settings->>'businessName', ''), 'Restaurante') as business_name,
  coalesce(s.settings->>'businessLogoUrl', '') as logo_url,
  coalesce(nullif(s.settings->>'restaurantAddress', ''), nullif(s.settings->>'legalAddress', ''), '') as public_address,
  coalesce(s.settings->>'businessPhone', '') as phone,
  '' as description,
  true as active,
  now() as updated_at
from public.app_settings s
on conflict (user_id)
do update set
  business_name = excluded.business_name,
  logo_url = excluded.logo_url,
  public_address = excluded.public_address,
  phone = excluded.phone,
  updated_at = now();

insert into public.user_profiles (
  user_id,
  full_name,
  phone,
  preferred_language,
  updated_at
)
select
  cp.user_id,
  cp.full_name,
  cp.phone,
  cp.language,
  now()
from public.customer_profiles cp
on conflict (user_id)
do update set
  full_name = case
    when nullif(public.user_profiles.full_name, '') is null then excluded.full_name
    else public.user_profiles.full_name
  end,
  phone = case
    when nullif(public.user_profiles.phone, '') is null then excluded.phone
    else public.user_profiles.phone
  end,
  preferred_language = case
    when nullif(public.user_profiles.preferred_language, '') is null then excluded.preferred_language
    else public.user_profiles.preferred_language
  end,
  updated_at = now();

insert into public.user_profiles (
  user_id,
  full_name,
  phone,
  updated_at
)
select
  rp.user_id,
  rp.business_name,
  rp.phone,
  now()
from public.restaurant_profiles rp
on conflict (user_id)
do update set
  phone = case
    when nullif(public.user_profiles.phone, '') is null then excluded.phone
    else public.user_profiles.phone
  end,
  updated_at = now();

insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
select
  cp.user_id,
  'customer',
  'platform',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'active',
  now()
from public.customer_profiles cp
on conflict (user_id, role, scope_type, scope_id)
do update set
  status = 'active',
  updated_at = now();

insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
select
  rp.user_id,
  'restaurant_owner',
  'platform',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'active',
  now()
from public.restaurant_profiles rp
on conflict (user_id, role, scope_type, scope_id)
do update set
  status = 'active',
  updated_at = now();

create or replace function public.get_public_restaurant_menu(p_user_id uuid)
returns table(menu jsonb, settings jsonb)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(s.menu, '{}'::jsonb) as menu,
    jsonb_strip_nulls(
      jsonb_build_object(
        'businessName', coalesce(nullif(s.settings->>'businessName', ''), nullif(rp.business_name, ''), 'Restaurante'),
        'businessLogoUrl', coalesce(nullif(s.settings->>'businessLogoUrl', ''), nullif(rp.logo_url, '')),
        'currencySymbol', s.settings->>'currencySymbol',
        'currencyPosition', s.settings->>'currencyPosition',
        'moneyFormat', s.settings->>'moneyFormat',
        'deliveryFee', s.settings->'deliveryFee',
        'deliveryMinimumFee', s.settings->'deliveryMinimumFee',
        'restaurantAddress', s.settings->>'restaurantAddress',
        'googleMapsApiKey', s.settings->>'googleMapsApiKey',
        'bankAccount', s.settings->>'bankAccount',
        'bankTransferNote', s.settings->>'bankTransferNote'
      )
    ) as settings
  from public.app_settings s
  left join public.restaurant_profiles rp on rp.user_id = s.user_id
  where s.user_id = p_user_id
    and coalesce(rp.active, true) = true
  limit 1;
$$;

grant execute on function public.get_public_restaurant_menu(uuid) to anon, authenticated;

alter table public.customer_orders
add column if not exists public_token text;

alter table public.customer_orders
add column if not exists customer_user_id uuid references auth.users(id) on delete set null;

update public.customer_orders
set public_token = encode(gen_random_bytes(16), 'hex')
where public_token is null;

alter table public.customer_orders
alter column public_token set default encode(gen_random_bytes(16), 'hex');

alter table public.customer_orders
alter column public_token set not null;

alter table public.customer_orders
drop constraint if exists customer_orders_status_check;

alter table public.customer_orders
add constraint customer_orders_status_check
check (status in ('pending', 'accepted', 'sent', 'delivered', 'cancelled'));
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
  v_order_id uuid := coalesce(p_id, gen_random_uuid());
  v_existing public.customer_orders%rowtype;
  v_restaurant_country text := '';
  v_restaurant_region text := '';
  v_menu jsonb := '{}'::jsonb;
  v_settings jsonb := '{}'::jsonb;
  v_requested_item jsonb;
  v_menu_item jsonb;
  v_product_id text;
  v_quantity integer;
  v_total_quantity integer := 0;
  v_unit_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_clean_items jsonb := '[]'::jsonb;
  v_delivery jsonb;
  v_quote_id uuid;
  v_quote_token text;
  v_quote public.delivery_quotes%rowtype;
  v_fee jsonb := jsonb_build_object('base', 0, 'distance', 0, 'operational', 0, 'platform', 0, 'final', 0);
  v_final_delivery numeric := 0;
  v_final_total numeric := 0;
  v_currency text := '';
  v_payment_method text := trim(coalesce(p_order_json->>'paymentMethod', ''));
  v_payload jsonb;
begin
  if p_user_id is null then raise exception 'Restaurant is required'; end if;
  if p_public_token is null or length(trim(p_public_token)) < 8 then raise exception 'Invalid public token'; end if;
  if trim(coalesce(p_customer_name, '')) = '' then raise exception 'Customer name is required'; end if;
  if p_order_type not in ('Comer en el punto', 'Recoger en el punto', 'Domicilio') then
    raise exception 'Invalid order type';
  end if;
  if v_payment_method not in ('Efectivo', 'Transferencia', 'Datafono', 'Pago en caja', 'Pago al recoger', 'Online') then
    raise exception 'Invalid payment method';
  end if;

  select co.* into v_existing
  from public.customer_orders co
  where co.id = v_order_id;
  if found then
    if v_existing.user_id = p_user_id
       and v_existing.public_token = p_public_token
       and v_existing.customer_user_id is not distinct from auth.uid() then
      return query select v_existing.id, v_existing.public_token;
      return;
    end if;
    raise exception 'Idempotency conflict';
  end if;

  select
    upper(trim(coalesce(rp.country_code, ''))),
    lower(trim(coalesce(rp.region, ''))),
    coalesce(s.menu, '{}'::jsonb),
    coalesce(s.settings, '{}'::jsonb)
  into v_restaurant_country, v_restaurant_region, v_menu, v_settings
  from public.restaurant_profiles rp
  join public.app_settings s on s.user_id = rp.user_id
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
    end = true
  for share of rp, s;
  if not found then raise exception 'Restaurant is closed'; end if;

  if v_payment_method = 'Online'
     and lower(trim(coalesce(v_settings->>'onlinePaymentProvider', 'disabled'))) <> 'stripe' then
    raise exception 'Online payment is unavailable';
  end if;

  if jsonb_typeof(coalesce(p_order_json->'items', 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_order_json->'items') = 0
     or jsonb_array_length(p_order_json->'items') > 60 then
    raise exception 'Invalid product list';
  end if;

  for v_requested_item in select value from jsonb_array_elements(p_order_json->'items')
  loop
    v_product_id := trim(coalesce(v_requested_item->>'product_id', ''));
    if v_product_id = '' or length(v_product_id) > 200 then raise exception 'Invalid product'; end if;

    select dish.value into v_menu_item
    from jsonb_each(v_menu) category
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(category.value) = 'array' then category.value else '[]'::jsonb end
    ) dish
    where trim(coalesce(dish.value->>'id', '')) = v_product_id
    limit 1;

    if v_menu_item is null then raise exception 'Product not found'; end if;
    if jsonb_typeof(v_menu_item->'available') = 'boolean'
       and (v_menu_item->>'available')::boolean is false then
      raise exception 'Product unavailable';
    end if;

    v_quantity := floor(public.rc_ordera_jsonb_numeric(v_requested_item->'quantity', 1))::integer;
    if v_quantity < 1 or v_quantity > 50 then raise exception 'Invalid product quantity'; end if;
    v_total_quantity := v_total_quantity + v_quantity;
    if v_total_quantity > 200 then raise exception 'Order quantity limit exceeded'; end if;

    v_unit_price := round(greatest(public.rc_ordera_jsonb_numeric(v_menu_item->'price', 0), 0), 2);
    v_line_total := round(v_unit_price * v_quantity, 2);
    v_subtotal := v_subtotal + v_line_total;

    v_clean_items := v_clean_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'product_name_snapshot', left(trim(coalesce(v_menu_item->>'name', 'Producto')), 200),
      'unit_price_snapshot', v_unit_price,
      'quantity', v_quantity,
      'options_snapshot', jsonb_build_object(
        'description', left(coalesce(v_menu_item->>'description', ''), 1000),
        'note', upper(left(coalesce(v_requested_item #>> '{options_snapshot,note}', v_requested_item->>'note', ''), 1000)),
        'station', left(trim(coalesce(v_menu_item->>'station', 'Cocina')), 80)
      ),
      'total_snapshot', v_line_total,
      'name', left(trim(coalesce(v_menu_item->>'name', 'Producto')), 200),
      'description', left(coalesce(v_menu_item->>'description', ''), 1000),
      'price', v_unit_price,
      'qty', v_quantity,
      'note', upper(left(coalesce(v_requested_item->>'note', ''), 1000)),
      'station', left(trim(coalesce(v_menu_item->>'station', 'Cocina')), 80)
    ));
    v_menu_item := null;
  end loop;

  v_subtotal := round(v_subtotal, 2);
  if v_subtotal <= 0 or v_subtotal > 100000000 then raise exception 'Invalid order total'; end if;

  v_delivery := coalesce(p_order_json->'delivery', 'null'::jsonb);
  if p_order_type = 'Domicilio' then
    if jsonb_typeof(v_delivery) <> 'object' then raise exception 'Delivery information is required'; end if;
    if length(trim(coalesce(v_delivery->>'phone', ''))) < 5 then raise exception 'Delivery phone is required'; end if;
    if length(trim(coalesce(v_delivery->>'address', ''))) < 5 then raise exception 'Delivery address is required'; end if;
    if v_restaurant_country = '' then raise exception 'Restaurant country is not configured'; end if;
    if upper(trim(coalesce(v_delivery->>'countryCode', ''))) <> v_restaurant_country then
      raise exception 'Restaurant country does not match delivery country';
    end if;
    begin
      v_quote_id := (v_delivery->>'quoteId')::uuid;
    exception when others then
      raise exception 'Valid delivery quote is required';
    end;
    v_quote_token := trim(coalesce(v_delivery->>'quoteToken', ''));
    if length(v_quote_token) < 32 then raise exception 'Valid delivery quote is required'; end if;

    select dq.* into v_quote
    from public.delivery_quotes dq
    where dq.id = v_quote_id
    for update;
    if not found
       or v_quote.restaurant_user_id <> p_user_id
       or v_quote.token_hash <> encode(digest(v_quote_token, 'sha256'), 'hex')
       or v_quote.used_at is not null
       or v_quote.expires_at <= now()
       or (v_quote.customer_user_id is not null and v_quote.customer_user_id is distinct from auth.uid()) then
      raise exception 'Delivery quote is invalid or expired';
    end if;

    v_fee := v_quote.fee_breakdown;
    v_final_delivery := v_quote.final_fee;
    v_currency := v_quote.currency;
    v_delivery := v_delivery || jsonb_build_object(
      'distanceKm', v_quote.distance_km,
      'durationSeconds', v_quote.duration_seconds,
      'serverValidated', true,
      'quoteId', v_quote.id,
      'quoteExpiresAt', v_quote.expires_at,
      'fee', v_final_delivery,
      'feeBreakdown', v_fee
    ) - 'quoteToken';
  else
    v_delivery := 'null'::jsonb;
  end if;

  if v_currency = '' then
    v_currency := case
      when v_restaurant_country = 'PL' then 'PLN'
      when v_restaurant_country = 'CO' then 'COP'
      else upper(left(coalesce(v_settings->>'currencyCode', ''), 3))
    end;
  end if;
  if v_currency = '' then raise exception 'Restaurant currency is not configured'; end if;

  v_final_total := round(v_subtotal + v_final_delivery, 2);
  v_payload := coalesce(p_order_json, '{}'::jsonb) || jsonb_build_object(
    'items', v_clean_items,
    'delivery', v_delivery,
    'subtotal', v_subtotal,
    'total', v_final_total,
    'currency', v_currency,
    'pricingSource', 'server-v86'
  );

  return query
  insert into public.customer_orders (
    id, idempotency_key, public_token, user_id, customer_user_id, status, table_label,
    customer_name, order_type, order_json, total, currency, subtotal,
    base_delivery_fee, distance_fee, operational_adjustment, platform_adjustment,
    final_delivery_fee, payment_method, payment_status, payment_amount, payment_currency,
    created_at, updated_at
  ) values (
    v_order_id, v_order_id::text, trim(p_public_token), p_user_id, auth.uid(), 'pending',
    left(trim(coalesce(p_table_label, '')), 160), left(trim(p_customer_name), 160),
    p_order_type, v_payload, v_final_total, v_currency, v_subtotal,
    public.rc_ordera_jsonb_numeric(v_fee->'base', 0),
    public.rc_ordera_jsonb_numeric(v_fee->'distance', 0),
    public.rc_ordera_jsonb_numeric(v_fee->'operational', 0),
    public.rc_ordera_jsonb_numeric(v_fee->'platform', 0),
    v_final_delivery,
    v_payment_method, 'pending', v_final_total, v_currency,
    now(), now()
  )
  returning public.customer_orders.id, public.customer_orders.public_token;

  if p_order_type = 'Domicilio' then
    update public.delivery_quotes
    set used_at = now(), used_by_order_id = v_order_id
    where id = v_quote_id;
  end if;
end;
$$;

create or replace function public.get_customer_order_status(
  p_order_id uuid,
  p_public_token text
)
returns table(status text, updated_at timestamptz, restaurant_order_id uuid, ticket_number integer)
language sql
security definer
set search_path = public
as $$
  select co.status, co.updated_at, co.restaurant_order_id, o.ticket_number
  from public.customer_orders co
  left join public.orders o on o.id = co.restaurant_order_id
  where co.id = p_order_id
    and co.public_token = p_public_token
  limit 1;
$$;

revoke all on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, numeric
) from public;

grant execute on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, numeric
) to anon, authenticated;
grant execute on function public.get_customer_order_status(uuid, text) to anon, authenticated;

create or replace function public.get_customer_order_history()
returns table(
  id uuid,
  public_token text,
  restaurant_user_id uuid,
  restaurant_name text,
  status text,
  table_label text,
  customer_name text,
  order_type text,
  order_json jsonb,
  total numeric,
  restaurant_order_id uuid,
  ticket_number integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    co.id,
    co.public_token,
    co.user_id as restaurant_user_id,
    coalesce(nullif(rp.business_name, ''), nullif(s.settings->>'businessName', ''), 'Restaurante') as restaurant_name,
    co.status,
    co.table_label,
    co.customer_name,
    co.order_type,
    co.order_json,
    co.total,
    co.restaurant_order_id,
    o.ticket_number,
    co.created_at,
    co.updated_at
  from public.customer_orders co
  left join public.orders o on o.id = co.restaurant_order_id
  left join public.app_settings s on s.user_id = co.user_id
  left join public.restaurant_profiles rp on rp.user_id = co.user_id
  where co.customer_user_id = auth.uid()
  order by co.created_at desc
  limit 100;
$$;

grant execute on function public.get_customer_order_history() to authenticated;

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

create index if not exists customer_order_messages_order_created_idx
on public.customer_order_messages (order_id, created_at);

create or replace function public.create_customer_message(
  p_order_id uuid,
  p_public_token text,
  p_body text,
  p_image_data_url text
)
returns table(id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_body text := left(trim(coalesce(p_body, '')), 1200);
  v_image text := coalesce(p_image_data_url, '');
begin
  select co.user_id
    into v_user_id
  from public.customer_orders co
  where co.id = p_order_id
    and co.public_token = p_public_token;

  if v_user_id is null then
    raise exception 'Order not found';
  end if;

  if v_image <> '' and v_image not like 'data:image/%' then
    raise exception 'Invalid image';
  end if;

  if length(v_image) > 950000 then
    raise exception 'Image too large';
  end if;

  if v_body = '' and v_image = '' then
    raise exception 'Empty message';
  end if;

  return query
  insert into public.customer_order_messages (order_id, user_id, sender, body, image_data_url)
  values (p_order_id, v_user_id, 'customer', v_body, v_image)
  returning public.customer_order_messages.id;
end;
$$;

create or replace function public.create_restaurant_message(
  p_order_id uuid,
  p_body text,
  p_image_data_url text
)
returns table(id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := left(trim(coalesce(p_body, '')), 1200);
  v_image text := coalesce(p_image_data_url, '');
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.customer_orders co
    where co.id = p_order_id
      and co.user_id = v_user_id
  ) then
    raise exception 'Order not found';
  end if;

  if v_image <> '' and v_image not like 'data:image/%' then
    raise exception 'Invalid image';
  end if;

  if length(v_image) > 950000 then
    raise exception 'Image too large';
  end if;

  if v_body = '' and v_image = '' then
    raise exception 'Empty message';
  end if;

  return query
  insert into public.customer_order_messages (order_id, user_id, sender, body, image_data_url)
  values (p_order_id, v_user_id, 'restaurant', v_body, v_image)
  returning public.customer_order_messages.id;
end;
$$;

create or replace function public.get_customer_order_messages(
  p_order_id uuid,
  p_public_token text
)
returns table(id uuid, sender text, body text, image_data_url text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select msg.id, msg.sender, msg.body, msg.image_data_url, msg.created_at
  from public.customer_order_messages msg
  join public.customer_orders co on co.id = msg.order_id
  where co.id = p_order_id
    and co.public_token = p_public_token
  order by msg.created_at asc;
$$;

create or replace function public.get_restaurant_order_messages(
  p_order_id uuid
)
returns table(id uuid, sender text, body text, image_data_url text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select msg.id, msg.sender, msg.body, msg.image_data_url, msg.created_at
  from public.customer_order_messages msg
  join public.customer_orders co on co.id = msg.order_id
  where co.id = p_order_id
    and co.user_id = auth.uid()
  order by msg.created_at asc;
$$;

grant execute on function public.create_customer_message(uuid, text, text, text) to anon, authenticated;
grant execute on function public.create_restaurant_message(uuid, text, text) to authenticated;
grant execute on function public.get_customer_order_messages(uuid, text) to anon, authenticated;
grant execute on function public.get_restaurant_order_messages(uuid) to authenticated;

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

grant execute on function public.claim_next_ticket(date) to authenticated;
grant execute on function public.set_next_ticket(date, integer) to authenticated;

-- V69: cierre/eliminacion logica confirmada del restaurante.
create or replace function public.set_current_restaurant_active(p_active boolean)
returns table (
  restaurant_user_id uuid,
  restaurant_active boolean,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_name text := 'Restaurante';
  v_logo_url text := '';
  v_public_address text := '';
  v_phone text := '';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.restaurant_profiles rp where rp.user_id = v_user_id
  ) and not exists (
    select 1 from public.app_settings s where s.user_id = v_user_id
  ) then
    raise exception 'Restaurant profile not found';
  end if;

  select
    coalesce(nullif(trim(s.settings->>'businessName'), ''), 'Restaurante'),
    coalesce(s.settings->>'businessLogoUrl', ''),
    coalesce(nullif(trim(s.settings->>'restaurantAddress'), ''), nullif(trim(s.settings->>'legalAddress'), ''), ''),
    coalesce(s.settings->>'businessPhone', '')
  into
    v_business_name,
    v_logo_url,
    v_public_address,
    v_phone
  from public.app_settings s
  where s.user_id = v_user_id;

  insert into public.restaurant_profiles (
    user_id,
    business_name,
    logo_url,
    public_address,
    phone,
    active,
    updated_at
  )
  values (
    v_user_id,
    coalesce(nullif(trim(v_business_name), ''), 'Restaurante'),
    coalesce(v_logo_url, ''),
    coalesce(v_public_address, ''),
    coalesce(v_phone, ''),
    p_active,
    now()
  )
  on conflict (user_id)
  do update set
    active = excluded.active,
    updated_at = now();

  update public.app_settings
  set
    settings = coalesce(settings, '{}'::jsonb)
      || jsonb_build_object('restaurantActive', p_active),
    updated_at = now()
  where user_id = v_user_id;

  return query
  select rp.user_id, rp.active, rp.updated_at
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;
end;
$$;

create or replace function public.request_current_restaurant_deletion()
returns table (
  restaurant_user_id uuid,
  restaurant_active boolean,
  changed_at timestamptz,
  privacy_request_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_business_name text := '';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.set_current_restaurant_active(false);

  select rp.business_name
  into v_business_name
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;

  select apr.id
  into v_request_id
  from public.account_privacy_requests apr
  where apr.user_id = v_user_id
    and apr.request_type = 'restaurant_deletion'
    and apr.status in ('requested', 'in_review')
  order by apr.created_at desc
  limit 1;

  if v_request_id is null then
    insert into public.account_privacy_requests (
      user_id,
      request_type,
      role_context,
      status,
      details
    )
    values (
      v_user_id,
      'restaurant_deletion',
      'restaurant_owner',
      'requested',
      jsonb_build_object(
        'businessName', coalesce(v_business_name, ''),
        'requestedAt', now()
      )
    )
    returning id into v_request_id;
  end if;

  return query
  select rp.user_id, rp.active, rp.updated_at, v_request_id
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;
end;
$$;

create or replace function public.get_public_restaurant_menu(p_user_id uuid)
returns table(menu jsonb, settings jsonb)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(s.menu, '{}'::jsonb) as menu,
    jsonb_strip_nulls(
      jsonb_build_object(
        'businessName', coalesce(nullif(s.settings->>'businessName', ''), nullif(rp.business_name, ''), 'Restaurante'),
        'businessLogoUrl', coalesce(nullif(s.settings->>'businessLogoUrl', ''), nullif(rp.logo_url, '')),
        'currencySymbol', s.settings->>'currencySymbol',
        'currencyPosition', s.settings->>'currencyPosition',
        'moneyFormat', s.settings->>'moneyFormat',
        'deliveryFee', s.settings->'deliveryFee',
        'deliveryMinimumFee', s.settings->'deliveryMinimumFee',
        'restaurantAddress', s.settings->>'restaurantAddress',
        'googleMapsApiKey', s.settings->>'googleMapsApiKey',
        'bankAccount', s.settings->>'bankAccount',
        'bankTransferNote', s.settings->>'bankTransferNote',
        'restaurantActive', rp.active
      )
    ) as settings
  from public.app_settings s
  join public.restaurant_profiles rp
    on rp.user_id = s.user_id
   and rp.active = true
  where s.user_id = p_user_id
  limit 1;
$$;

revoke all on function public.set_current_restaurant_active(boolean) from public;
revoke all on function public.request_current_restaurant_deletion() from public;
grant execute on function public.set_current_restaurant_active(boolean) to authenticated;
grant execute on function public.request_current_restaurant_deletion() to authenticated;
grant execute on function public.get_public_restaurant_menu(uuid) to anon, authenticated;

-- V70: la autorizacion administrativa usa user_id y rol, sin exponer el correo.
create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'platform_admin'
      and ur.scope_type = 'platform'
      and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
      and ur.status = 'active'
  );
$$;

create or replace function public.user_can_review_couriers()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.is_platform_owner();
$$;

do $migration$
begin
  if to_regprocedure('public.platform_owner_email()') is not null then
    execute 'revoke all on function public.platform_owner_email() from public';
    execute 'revoke all on function public.platform_owner_email() from anon';
    execute 'revoke all on function public.platform_owner_email() from authenticated';
  end if;
end;
$migration$;

revoke all on function public.is_platform_owner() from public;
revoke all on function public.is_platform_owner() from anon;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.user_can_review_couriers() to authenticated;
-- ============================================================
-- RC ORDERA - CIERRE DE SEGURIDAD / REALTIME V82
-- ============================================================

revoke all on function public.rc_ordera_is_platform_admin(uuid)
from public, anon;

revoke all on function public.rc_ordera_actor_role(uuid, uuid)
from public, anon, authenticated;

revoke all on function public.rc_ordera_can_access_order(uuid)
from public, anon;

revoke all on function public.set_courier_availability(boolean)
from public, anon;

revoke all on function public.upsert_courier_live_location(
  boolean, numeric, numeric, integer
) from public, anon;

revoke all on function public.review_courier_profile(uuid, text)
from public, anon;

revoke all on function public.update_delivery_assignment_status(uuid, text)
from public, anon;

revoke all on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, numeric
) from public;


grant execute on function public.rc_ordera_is_platform_admin(uuid)
to authenticated;

grant execute on function public.rc_ordera_can_access_order(uuid)
to authenticated;

grant execute on function public.set_courier_availability(boolean)
to authenticated;

grant execute on function public.upsert_courier_live_location(
  boolean, numeric, numeric, integer
) to authenticated;

grant execute on function public.review_courier_profile(uuid, text)
to authenticated;

grant execute on function public.update_delivery_assignment_status(uuid, text)
to authenticated;

grant execute on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, numeric
) to anon, authenticated;


grant select on public.order_status_history
to authenticated;

grant select on public.platform_audit_logs
to authenticated;

grant select, update on public.notifications
to authenticated;

grant select, insert, update, delete
on public.courier_push_subscriptions
to authenticated;


-- Las escrituras directas quedan bloqueadas.
-- Deben pasar por las RPC validadas.

revoke insert on public.customer_orders
from authenticated;

revoke insert, update on public.courier_live_locations
from authenticated;

revoke insert, update on public.delivery_assignments
from authenticated;

revoke insert, update, delete on public.order_status_history
from anon, authenticated;

revoke insert, update, delete on public.platform_audit_logs
from anon, authenticated;


-- ============================================================
-- REALTIME
-- ============================================================

do $realtime$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'delivery_assignments'
    ) then
      execute
        'alter publication supabase_realtime add table public.delivery_assignments';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      execute
        'alter publication supabase_realtime add table public.notifications';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'order_status_history'
    ) then
      execute
        'alter publication supabase_realtime add table public.order_status_history';
    end if;

  end if;
end;
$realtime$;


-- ============================================================
-- VERIFICACION FINAL DEL NUCLEO V82
-- ============================================================

do $verify$
begin
  if to_regprocedure(
       'public.set_courier_availability(boolean)'
     ) is null

     or to_regprocedure(
       'public.update_delivery_assignment_status(uuid,text)'
     ) is null

     or to_regprocedure(
       'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)'
     ) is null

     or to_regclass(
       'public.order_status_history'
     ) is null

     or to_regclass(
       'public.courier_push_subscriptions'
     ) is null

     or to_regclass(
       'public.notifications'
     ) is null
  then
    raise exception
      'V82 no pudo completar su contrato de estabilidad.';
  end if;
end;
$verify$;

notify pgrst, 'reload schema';
