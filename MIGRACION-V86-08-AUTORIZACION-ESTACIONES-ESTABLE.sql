-- RC ORDERA V86.08
-- Consolida el contrato entre el panel del propietario y las estaciones.
-- Idempotente y no destructiva: no elimina ni modifica invitaciones o membresias.

begin;

do $$
begin
  if to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.restaurant_staff_invitations') is null
     or to_regclass('public.restaurant_staff_memberships') is null
     or to_regclass('public.user_roles') is null then
    raise exception 'Ejecuta primero las migraciones base de perfiles, roles y personal del restaurante';
  end if;
  if to_regprocedure('public.activate_restaurant_staff_membership_internal(uuid,uuid,text,text,jsonb,uuid)') is null then
    raise exception 'Ejecuta primero MIGRACION-V85-02-ESTACIONES-TURNOS-CIERRES.sql';
  end if;
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
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner_id uuid := auth.uid();
begin
  if v_owner_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = v_owner_id and rp.active = true and rp.deleted_at is null
  ) then raise exception 'Restaurant owner profile is missing'; end if;

  return query
  select team.record_key, team.member_user_id, team.member_email, team.station,
    team.display_name, team.active, team.pending, team.updated_at
  from (
    select
      ('member:' || m.member_user_id::text || ':' || m.station)::text as record_key,
      m.member_user_id,
      lower(coalesce(au.email, ''))::text as member_email,
      m.station::text,
      m.display_name::text,
      m.active,
      false as pending,
      m.updated_at
    from public.restaurant_staff_memberships m
    join auth.users au on au.id = m.member_user_id
    where m.restaurant_user_id = v_owner_id

    union all

    select
      ('invite:' || lower(i.email))::text,
      null::uuid,
      lower(i.email)::text,
      i.station::text,
      i.display_name::text,
      false,
      true,
      i.updated_at
    from public.restaurant_staff_invitations i
    where i.restaurant_user_id = v_owner_id and i.status = 'pending'
  ) team
  order by team.pending desc, team.active desc, team.display_name, team.station;
end;
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
#variable_conflict use_column
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
  ) then raise exception 'Restaurant owner profile is missing'; end if;
  if v_email = '' then raise exception 'Employee email is invalid'; end if;

  select i.* into v_invitation
  from public.restaurant_staff_invitations i
  where i.restaurant_user_id = v_owner_id
    and lower(i.email) = v_email
    and i.status = 'pending'
  for update;

  if not found then
    return query
    select m.member_user_id, lower(coalesce(au.email, ''))::text,
      m.station, m.display_name, m.active, false
    from public.restaurant_staff_memberships m
    join auth.users au on au.id = m.member_user_id
    where m.restaurant_user_id = v_owner_id
      and lower(coalesce(au.email, '')) = v_email
      and m.active = true
    order by m.updated_at desc
    limit 1;
    if found then return; end if;
    raise exception 'Staff invitation was not found';
  end if;

  select au.id into v_member_id
  from auth.users au
  where lower(coalesce(au.email, '')) = v_email
  limit 1;

  if v_member_id is null then
    return query select null::uuid, v_email, v_invitation.station,
      v_invitation.display_name, false, true;
    return;
  end if;

  perform public.activate_restaurant_staff_membership_internal(
    v_owner_id,
    v_member_id,
    v_invitation.station,
    v_invitation.display_name,
    v_invitation.permissions,
    v_owner_id
  );

  update public.restaurant_staff_invitations i
  set status = 'claimed', claimed_by_user_id = v_member_id,
      claimed_at = now(), updated_at = now()
  where i.restaurant_user_id = v_owner_id and lower(i.email) = v_email;

  return query
  select m.member_user_id, v_email, m.station, m.display_name, m.active, false
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = v_owner_id
    and m.member_user_id = v_member_id
    and m.station = v_invitation.station
    and m.active = true;
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
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_member_id uuid := auth.uid();
  v_email text;
  v_invitation public.restaurant_staff_invitations%rowtype;
begin
  if v_member_id is null then raise exception 'Not authenticated'; end if;
  if p_restaurant_user_id is null then raise exception 'Restaurant is required'; end if;

  select lower(trim(coalesce(au.email, ''))) into v_email
  from auth.users au where au.id = v_member_id;

  select i.* into v_invitation
  from public.restaurant_staff_invitations i
  where i.restaurant_user_id = p_restaurant_user_id
    and lower(i.email) = v_email
    and i.status = 'pending'
  for update;

  if found then
    perform public.activate_restaurant_staff_membership_internal(
      p_restaurant_user_id,
      v_member_id,
      v_invitation.station,
      v_invitation.display_name,
      v_invitation.permissions,
      coalesce(v_invitation.invited_by_user_id, p_restaurant_user_id)
    );
    update public.restaurant_staff_invitations i
    set status = 'claimed', claimed_by_user_id = v_member_id,
        claimed_at = now(), updated_at = now()
    where i.restaurant_user_id = p_restaurant_user_id and lower(i.email) = v_email;
  end if;

  return query
  select m.restaurant_user_id, m.station, m.display_name, m.permissions,
    coalesce(nullif(rp.business_name, ''), 'Restaurante')::text,
    coalesce(rp.logo_url, '')::text, m.active
  from public.restaurant_staff_memberships m
  join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = v_member_id
    and m.active = true
    and rp.active = true
    and rp.deleted_at is null
  order by m.updated_at desc
  limit 1;
end;
$$;

revoke all on function public.list_current_restaurant_team() from public, anon;
revoke all on function public.confirm_current_restaurant_staff_invitation(text) from public, anon;
revoke all on function public.claim_my_restaurant_staff_invitation(uuid) from public, anon;
grant execute on function public.list_current_restaurant_team() to authenticated;
grant execute on function public.confirm_current_restaurant_staff_invitation(text) to authenticated;
grant execute on function public.claim_my_restaurant_staff_invitation(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Validacion como propietario autenticado:
-- select * from public.list_current_restaurant_team();
