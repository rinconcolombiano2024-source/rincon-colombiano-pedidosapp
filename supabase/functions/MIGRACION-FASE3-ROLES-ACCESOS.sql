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
  photo_url text not null default '',
  verification_selfie_url text not null default '',
  work_permit_url text not null default '',
  vehicle_type text not null default '',
  vehicle_plate text not null default '',
  driver_license text not null default '',
  insurance_info text not null default '',
  bank_account text not null default '',
  availability jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (
    status in ('draft', 'pending_review', 'approved', 'rejected', 'suspended', 'inactive')
  ),
  terms_accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.courier_profiles enable row level security;

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
using (public.user_has_active_role('platform_admin'))
with check (public.user_has_active_role('platform_admin'));

drop policy if exists "Users read own roles" on public.user_roles;
create policy "Users read own roles"
on public.user_roles
for select
using (auth.uid() = user_id);

drop policy if exists "Platform admins manage roles" on public.user_roles;
create policy "Platform admins manage roles"
on public.user_roles
for all
using (public.user_has_active_role('platform_admin'))
with check (public.user_has_active_role('platform_admin'));

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
using (public.user_has_active_role('platform_admin'))
with check (public.user_has_active_role('platform_admin'));

grant select, insert, update on public.user_profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update on public.courier_profiles to authenticated;
grant execute on function public.user_has_active_role(text) to authenticated;
grant execute on function public.activate_user_role(text, text, uuid) to authenticated;

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
