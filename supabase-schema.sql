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
alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.courier_profiles enable row level security;
alter table public.account_privacy_requests enable row level security;

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
set search_path = public
as $$
begin
  if p_public_token is null or length(trim(p_public_token)) < 8 then
    raise exception 'Invalid public token';
  end if;

  return query
  insert into public.customer_orders (
    id,
    public_token,
    user_id,
    customer_user_id,
    status,
    table_label,
    customer_name,
    order_type,
    order_json,
    total,
    created_at,
    updated_at
  )
  values (
    coalesce(p_id, gen_random_uuid()),
    p_public_token,
    p_user_id,
    auth.uid(),
    'pending',
    coalesce(p_table_label, ''),
    coalesce(p_customer_name, ''),
    coalesce(p_order_type, 'Comer en el punto'),
    coalesce(p_order_json, '{}'::jsonb),
    coalesce(p_total, 0),
    now(),
    now()
  )
  returning public.customer_orders.id, public.customer_orders.public_token;
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

grant execute on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) to anon;
grant execute on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) to authenticated;
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
