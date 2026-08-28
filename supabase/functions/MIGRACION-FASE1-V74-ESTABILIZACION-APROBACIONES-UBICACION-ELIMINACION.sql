-- RC ORDERA V74
-- Estabiliza aprobaciones, personal de estaciones, ubicacion de registro y eliminacion publica.
-- Migracion incremental e idempotente: no elimina tablas, usuarios, pedidos, menus ni archivos.

begin;

do $preflight$
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.courier_profiles') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.app_settings') is null
     or to_regclass('public.account_privacy_requests') is null
     or to_regclass('public.restaurant_staff_memberships') is null
     or to_regclass('public.restaurant_staff_invitations') is null then
    raise exception 'Falta la estructura base. Ejecuta primero las migraciones V72 y V73.';
  end if;
end;
$preflight$;

alter table public.user_profiles
  add column if not exists registration_latitude numeric(10, 7) null,
  add column if not exists registration_longitude numeric(10, 7) null,
  add column if not exists detected_timezone text not null default '';

alter table public.restaurant_profiles
  add column if not exists country_code text not null default '',
  add column if not exists city text not null default '',
  add column if not exists timezone text not null default '',
  add column if not exists preferred_language text not null default 'es';

alter table public.courier_profiles
  add column if not exists reviewed_at timestamptz null,
  add column if not exists reviewed_by_user_id uuid null references auth.users(id) on delete set null;

alter table public.courier_profiles
  alter column status set default 'pending_review';

create or replace function public.protect_courier_review_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_is_platform_admin boolean := auth.uid() is not null and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'platform_admin'
      and ur.scope_type = 'platform'
      and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
      and ur.status = 'active'
  );
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if v_is_platform_admin or v_is_service_role then return new; end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review')
       or new.reviewed_at is not null
       or new.reviewed_by_user_id is not null then
      raise exception using errcode = '42501', message = 'Courier approval fields are managed by the platform';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by_user_id is distinct from old.reviewed_by_user_id then
    raise exception using errcode = '42501', message = 'Courier approval fields are managed by the platform';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_courier_review_fields_trigger on public.courier_profiles;
create trigger protect_courier_review_fields_trigger
before insert or update on public.courier_profiles
for each row execute function public.protect_courier_review_fields();

create or replace function public.activate_user_role(
  p_role text,
  p_scope_type text default 'platform',
  p_scope_id uuid default '00000000-0000-0000-0000-000000000000'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := lower(trim(coalesce(p_role, '')));
  v_scope_type text := lower(trim(coalesce(p_scope_type, 'platform')));
  v_scope_id uuid := coalesce(p_scope_id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_status text := 'active';
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if v_role not in ('customer', 'restaurant_owner', 'platform_courier') then
    raise exception 'Role cannot be self-activated';
  end if;
  if v_scope_type <> 'platform' then raise exception 'This role must use platform scope'; end if;
  if v_role = 'platform_courier' then v_status := 'pending_review'; end if;

  insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
  values (v_user_id, v_role, v_scope_type, v_scope_id, v_status, now())
  on conflict (user_id, role, scope_type, scope_id)
  do update set
    status = case
      when public.user_roles.status = 'active' then 'active'
      when public.user_roles.status = 'suspended' then 'suspended'
      else excluded.status
    end,
    updated_at = now();
end;
$$;

create or replace function public.review_courier_profile(
  p_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_role_status text;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'platform_admin'
      and ur.scope_type = 'platform'
      and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
      and ur.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Not authorized to review couriers';
  end if;

  if p_user_id is null then
    raise exception using errcode = '22023', message = 'Courier user id is required';
  end if;
  if v_status not in ('approved', 'rejected', 'suspended', 'inactive', 'pending_review') then
    raise exception using errcode = '22023', message = 'Invalid courier status';
  end if;

  update public.courier_profiles
  set status = v_status,
      reviewed_at = now(),
      reviewed_by_user_id = auth.uid(),
      updated_at = now()
  where user_id = p_user_id;
  if not found then raise exception using errcode = 'P0002', message = 'Courier profile not found'; end if;

  v_role_status := case v_status
    when 'approved' then 'active'
    when 'rejected' then 'revoked'
    when 'suspended' then 'suspended'
    when 'inactive' then 'inactive'
    else 'pending_review'
  end;

  insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
  values (
    p_user_id, 'platform_courier', 'platform',
    '00000000-0000-0000-0000-000000000000'::uuid, v_role_status, now()
  )
  on conflict (user_id, role, scope_type, scope_id)
  do update set status = excluded.status, updated_at = now();

  if not exists (
    select 1
    from public.courier_profiles cp
    join public.user_roles ur
      on ur.user_id = cp.user_id
     and ur.role = 'platform_courier'
     and ur.scope_type = 'platform'
     and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
    where cp.user_id = p_user_id
      and cp.status = v_status
      and ur.status = v_role_status
  ) then
    raise exception 'Courier approval could not be confirmed';
  end if;
end;
$$;

create or replace function public.get_my_courier_approval()
returns table (
  profile_status text,
  role_status text,
  approved boolean,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    cp.status::text,
    coalesce(ur.status, '')::text,
    (cp.status = 'approved' and ur.status = 'active') as approved,
    cp.reviewed_at
  from public.courier_profiles cp
  left join public.user_roles ur
    on ur.user_id = cp.user_id
   and ur.role = 'platform_courier'
   and ur.scope_type = 'platform'
   and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
  where cp.user_id = auth.uid()
  limit 1;
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

  select * into v_invitation
  from public.restaurant_staff_invitations i
  where i.restaurant_user_id = v_owner_id
    and i.email = v_email
    and i.status = 'pending'
  for update;

  if not found then
    return query
    select m.member_user_id, coalesce(au.email, '')::text, m.station, m.display_name, m.active, false
    from public.restaurant_staff_memberships m
    join auth.users au on au.id = m.member_user_id
    where m.restaurant_user_id = v_owner_id
      and lower(trim(coalesce(au.email, ''))) = v_email
    order by m.active desc, m.updated_at desc
    limit 1;
    if found then return; end if;
    raise exception 'Staff invitation was not found';
  end if;

  select au.id into v_member_id
  from auth.users au
  where lower(trim(coalesce(au.email, ''))) = v_email
  limit 1;

  if v_member_id is null then
    return query select null::uuid, v_email, v_invitation.station,
      v_invitation.display_name, false, true;
    return;
  end if;

  update public.restaurant_staff_memberships
  set active = false, updated_at = now()
  where restaurant_user_id = v_owner_id
    and member_user_id = v_member_id
    and station <> v_invitation.station
    and active = true;

  insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
  values (v_member_id, 'restaurant_employee', 'restaurant', v_owner_id, 'active', now())
  on conflict (user_id, role, scope_type, scope_id)
  do update set status = 'active', updated_at = now();

  insert into public.restaurant_staff_memberships (
    restaurant_user_id, member_user_id, station, display_name,
    permissions, active, granted_by_user_id, updated_at
  ) values (
    v_owner_id, v_member_id, v_invitation.station, v_invitation.display_name,
    v_invitation.permissions, true, v_owner_id, now()
  )
  on conflict (restaurant_user_id, member_user_id, station)
  do update set
    display_name = excluded.display_name,
    permissions = excluded.permissions,
    active = true,
    granted_by_user_id = v_owner_id,
    updated_at = now();

  update public.restaurant_staff_invitations
  set status = 'claimed', claimed_by_user_id = v_member_id,
      claimed_at = now(), updated_at = now()
  where restaurant_user_id = v_owner_id and email = v_email;

  return query
  select m.member_user_id, v_email, m.station, m.display_name, m.active, false
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = v_owner_id
    and m.member_user_id = v_member_id
    and m.station = v_invitation.station
    and m.active = true;
end;
$$;

create or replace function public.prepare_current_restaurant_deletion()
returns table (
  restaurant_user_id uuid,
  hidden_from_customers boolean,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_changed_at timestamptz := now();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.restaurant_profiles rp where rp.user_id = v_user_id
  ) then raise exception 'Restaurant profile not found'; end if;

  update public.restaurant_profiles
  set active = false,
      operational_open = false,
      deleted_at = coalesce(deleted_at, v_changed_at),
      updated_at = v_changed_at
  where user_id = v_user_id;

  update public.app_settings
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'restaurantActive', false,
        'restaurantOperationalOpen', false,
        'restaurantDeletedAt', v_changed_at
      ),
      updated_at = v_changed_at
  where user_id = v_user_id;

  if not exists (
    select 1 from public.account_privacy_requests apr
    where apr.user_id = v_user_id
      and apr.request_type = 'restaurant_deletion'
      and apr.status in ('requested', 'in_review', 'approved')
  ) then
    insert into public.account_privacy_requests (
      user_id, request_type, role_context, status, details, created_at, updated_at
    ) values (
      v_user_id, 'restaurant_deletion', 'restaurant_owner', 'requested',
      jsonb_build_object('requestedAt', v_changed_at, 'hiddenFromCustomers', true),
      v_changed_at, v_changed_at
    );
  end if;

  return query select v_user_id, true, v_changed_at;
end;
$$;

revoke all on function public.get_my_courier_approval() from public, anon;
revoke all on function public.confirm_current_restaurant_staff_invitation(text) from public, anon;
revoke all on function public.prepare_current_restaurant_deletion() from public, anon;
revoke all on function public.review_courier_profile(uuid, text) from public, anon;
revoke all on function public.activate_user_role(text, text, uuid) from public, anon;
revoke all on function public.protect_courier_review_fields() from public, anon, authenticated;
grant execute on function public.activate_user_role(text, text, uuid) to authenticated;
grant execute on function public.get_my_courier_approval() to authenticated;
grant execute on function public.confirm_current_restaurant_staff_invitation(text) to authenticated;
grant execute on function public.prepare_current_restaurant_deletion() to authenticated;
grant execute on function public.review_courier_profile(uuid, text) to authenticated;

alter table public.courier_profiles replica identity full;

do $realtime$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'courier_profiles'
     ) then
    alter publication supabase_realtime add table public.courier_profiles;
  end if;
end;
$realtime$;

notify pgrst, 'reload schema';

commit;

-- Validaciones (ejecutar con las sesiones correspondientes):
-- select * from public.get_my_courier_approval();
-- select * from public.list_current_restaurant_team();
-- select user_id, business_name, active, operational_open, deleted_at
-- from public.restaurant_profiles order by updated_at desc;
