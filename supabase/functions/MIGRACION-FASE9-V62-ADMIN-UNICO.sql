-- Fase 9 / v62
-- Administrador unico de plataforma:
-- Jhon Jarolt Mendez / pedidosapprinconcolombiano@gmail.com
-- Ejecutar en Supabase SQL Editor.

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

drop policy if exists "Platform admins manage general profiles" on public.user_profiles;
create policy "Platform admins manage general profiles"
on public.user_profiles
for all
using (public.is_platform_owner())
with check (public.is_platform_owner());

drop policy if exists "Platform admins manage roles" on public.user_roles;
create policy "Platform admins manage roles"
on public.user_roles
for all
using (public.is_platform_owner())
with check (public.is_platform_owner());

drop policy if exists "Platform admins manage courier profiles" on public.courier_profiles;
create policy "Platform admins manage courier profiles"
on public.courier_profiles
for all
using (public.is_platform_owner())
with check (public.is_platform_owner());

drop policy if exists "Platform admins manage privacy requests" on public.account_privacy_requests;
create policy "Platform admins manage privacy requests"
on public.account_privacy_requests
for all
using (public.is_platform_owner())
with check (public.is_platform_owner());

grant execute on function public.platform_owner_email() to authenticated;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.user_can_review_couriers() to authenticated;

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
