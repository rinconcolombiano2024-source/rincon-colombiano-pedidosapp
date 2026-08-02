-- RC ORDERA V73
-- Autorizacion de personal antes o despues de que el empleado cree su cuenta.
-- Migracion incremental: no elimina membresias, usuarios, pedidos ni permisos existentes.

begin;

do $$
begin
  if to_regclass('public.restaurant_staff_memberships') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.user_roles') is null then
    raise exception 'Falta la estructura de personal. Ejecuta primero V71.';
  end if;
end;
$$;

create table if not exists public.restaurant_staff_invitations (
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  station text not null default 'waiter' check (
    station in ('waiter', 'cashier', 'kitchen', 'packing', 'dispatch', 'manager')
  ),
  display_name text not null default '',
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'revoked')),
  invited_by_user_id uuid null references auth.users(id) on delete set null,
  claimed_by_user_id uuid null references auth.users(id) on delete set null,
  claimed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_user_id, email),
  check (email = lower(trim(email)) and length(email) between 3 and 320)
);

create index if not exists restaurant_staff_invitations_email_status_idx
  on public.restaurant_staff_invitations (email, status, restaurant_user_id);

alter table public.restaurant_staff_invitations enable row level security;

drop policy if exists "Restaurant owners read own staff invitations" on public.restaurant_staff_invitations;
create policy "Restaurant owners read own staff invitations"
on public.restaurant_staff_invitations
for select
to authenticated
using (auth.uid() = restaurant_user_id);

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
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_member_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_station text := lower(trim(coalesce(p_station, 'waiter')));
  v_display_name text := left(trim(coalesce(p_display_name, '')), 100);
  v_permissions jsonb;
begin
  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1
    from public.restaurant_profiles rp
    where rp.user_id = v_owner_id
      and rp.active = true
  ) then
    raise exception 'Restaurant owner profile is missing';
  end if;
  if v_station not in ('waiter', 'cashier', 'kitchen', 'packing', 'dispatch', 'manager') then
    raise exception 'Invalid station';
  end if;
  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Employee email is invalid';
  end if;

  v_permissions := case
    when v_station in ('waiter', 'cashier', 'manager') then '{"create_orders":true}'::jsonb
    else '{}'::jsonb
  end;

  select au.id into v_member_id
  from auth.users au
  where lower(trim(au.email)) = v_email
  limit 1;

  if v_member_id = v_owner_id then
    raise exception 'Owner cannot be added as staff';
  end if;

  if v_member_id is null then
    insert into public.restaurant_staff_invitations (
      restaurant_user_id, email, station, display_name, permissions,
      status, invited_by_user_id, claimed_by_user_id, claimed_at, updated_at
    )
    values (
      v_owner_id, v_email, v_station,
      coalesce(nullif(v_display_name, ''), split_part(v_email, '@', 1)),
      v_permissions, 'pending', v_owner_id, null, null, now()
    )
    on conflict (restaurant_user_id, email)
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
    restaurant_user_id, member_user_id, station, display_name,
    permissions, active, granted_by_user_id, updated_at
  )
  values (
    v_owner_id, v_member_id, v_station,
    coalesce(nullif(v_display_name, ''), split_part(v_email, '@', 1)),
    v_permissions, true, v_owner_id, now()
  )
  on conflict (restaurant_user_id, member_user_id, station)
  do update set
    display_name = excluded.display_name,
    permissions = excluded.permissions,
    active = true,
    granted_by_user_id = v_owner_id,
    updated_at = now();

  delete from public.restaurant_staff_invitations
  where restaurant_user_id = v_owner_id and email = v_email;

  return query
  select m.member_user_id, v_email, m.station, m.display_name, m.active, false
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = v_owner_id
    and m.member_user_id = v_member_id
    and m.station = v_station;
end;
$$;

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
set search_path = public
as $$
  select
    'member:' || m.member_user_id::text || ':' || m.station,
    m.member_user_id,
    coalesce(au.email, '')::text,
    m.station,
    m.display_name,
    m.active,
    false,
    m.updated_at
  from public.restaurant_staff_memberships m
  join auth.users au on au.id = m.member_user_id
  where m.restaurant_user_id = auth.uid()

  union all

  select
    'invite:' || i.email,
    null::uuid,
    i.email,
    i.station,
    i.display_name,
    false,
    true,
    i.updated_at
  from public.restaurant_staff_invitations i
  where i.restaurant_user_id = auth.uid()
    and i.status = 'pending'
  order by pending desc, active desc, display_name, station;
$$;

create or replace function public.set_current_restaurant_staff_access(
  p_member_user_id uuid,
  p_email text,
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
  v_email text := lower(trim(coalesce(p_email, '')));
  v_station text := lower(trim(coalesce(p_station, '')));
begin
  if v_owner_id is null then raise exception 'Not authenticated'; end if;

  if p_member_user_id is null then
    update public.restaurant_staff_invitations
    set status = case when coalesce(p_active, false) then 'pending' else 'revoked' end,
        updated_at = now()
    where restaurant_user_id = v_owner_id
      and email = v_email
      and station = v_station;
    if not found then raise exception 'Staff invitation was not found'; end if;
    return;
  end if;

  perform public.set_current_restaurant_staff_active(p_member_user_id, v_station, p_active);
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
set search_path = public
as $$
declare
  v_member_id uuid := auth.uid();
  v_email text;
  v_invitation public.restaurant_staff_invitations%rowtype;
begin
  if v_member_id is null then raise exception 'Not authenticated'; end if;

  select lower(trim(au.email)) into v_email
  from auth.users au where au.id = v_member_id;

  select * into v_invitation
  from public.restaurant_staff_invitations i
  where i.restaurant_user_id = p_restaurant_user_id
    and i.email = v_email
    and i.status = 'pending'
  for update;

  if not found then return; end if;

  update public.restaurant_staff_memberships
  set active = false, updated_at = now()
  where restaurant_user_id = p_restaurant_user_id
    and member_user_id = v_member_id
    and station <> v_invitation.station
    and active = true;

  insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
  values (v_member_id, 'restaurant_employee', 'restaurant', p_restaurant_user_id, 'active', now())
  on conflict (user_id, role, scope_type, scope_id)
  do update set status = 'active', updated_at = now();

  insert into public.restaurant_staff_memberships (
    restaurant_user_id, member_user_id, station, display_name,
    permissions, active, granted_by_user_id, updated_at
  )
  values (
    p_restaurant_user_id, v_member_id, v_invitation.station,
    v_invitation.display_name, v_invitation.permissions, true,
    coalesce(v_invitation.invited_by_user_id, p_restaurant_user_id), now()
  )
  on conflict (restaurant_user_id, member_user_id, station)
  do update set
    display_name = excluded.display_name,
    permissions = excluded.permissions,
    active = true,
    updated_at = now();

  update public.restaurant_staff_invitations
  set status = 'claimed', claimed_by_user_id = v_member_id,
      claimed_at = now(), updated_at = now()
  where restaurant_user_id = p_restaurant_user_id and email = v_email;

  return query
  select m.restaurant_user_id, m.station, m.display_name, m.permissions,
         coalesce(nullif(rp.business_name, ''), 'Restaurante')::text,
         coalesce(rp.logo_url, '')::text, m.active
  from public.restaurant_staff_memberships m
  join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = v_member_id
    and m.station = v_invitation.station
    and m.active = true;
end;
$$;

revoke all on function public.invite_current_restaurant_staff(text, text, text) from public, anon;
revoke all on function public.list_current_restaurant_team() from public, anon;
revoke all on function public.set_current_restaurant_staff_access(uuid, text, text, boolean) from public, anon;
revoke all on function public.claim_my_restaurant_staff_invitation(uuid) from public, anon;
grant execute on function public.invite_current_restaurant_staff(text, text, text) to authenticated;
grant execute on function public.list_current_restaurant_team() to authenticated;
grant execute on function public.set_current_restaurant_staff_access(uuid, text, text, boolean) to authenticated;
grant execute on function public.claim_my_restaurant_staff_invitation(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobacion: devuelve membresias existentes e invitaciones pendientes del restaurante autenticado.
-- select * from public.list_current_restaurant_team();
