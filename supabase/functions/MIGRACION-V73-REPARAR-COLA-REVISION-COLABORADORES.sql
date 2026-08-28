-- RC ORDERA V73
-- Repara el contrato administrativo de revision de colaboradores.
-- Migracion idempotente: no elimina usuarios, perfiles, documentos ni roles existentes.

begin;

do $preflight$
begin
  if to_regclass('public.courier_profiles') is null then
    raise exception 'Falta public.courier_profiles. Ejecuta primero MIGRACION-FASE3-ROLES-ACCESOS.sql.';
  end if;

  if to_regclass('public.user_roles') is null then
    raise exception 'Falta public.user_roles. Ejecuta primero MIGRACION-FASE3-ROLES-ACCESOS.sql.';
  end if;
end;
$preflight$;

-- Estas tres columnas forman parte del contrato existente desde V58.
-- ADD COLUMN IF NOT EXISTS conserva cualquier dato ya guardado.
alter table public.courier_profiles
  add column if not exists identity_document_url text not null default '',
  add column if not exists driver_license_url text not null default '',
  add column if not exists insurance_url text not null default '';

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
set search_path = pg_catalog, public
as $$
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
    raise exception using
      errcode = '42501',
      message = 'Not authorized to review couriers';
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
      when 'suspended' then 4
      when 'inactive' then 5
      else 6
    end,
    cp.updated_at desc,
    cp.created_at desc;
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
    raise exception using
      errcode = '42501',
      message = 'Not authorized to review couriers';
  end if;

  if p_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Courier user id is required';
  end if;

  if v_status not in ('approved', 'rejected', 'suspended', 'inactive', 'pending_review') then
    raise exception using
      errcode = '22023',
      message = 'Invalid courier status';
  end if;

  if not exists (
    select 1
    from public.courier_profiles cp
    where cp.user_id = p_user_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Courier profile not found';
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

  insert into public.user_roles (
    user_id,
    role,
    scope_type,
    scope_id,
    status,
    updated_at
  )
  values (
    p_user_id,
    'platform_courier',
    'platform',
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_role_status,
    now()
  )
  on conflict (user_id, role, scope_type, scope_id)
  do update set
    status = excluded.status,
    updated_at = now();
end;
$$;

revoke all on function public.get_courier_review_queue() from public;
revoke all on function public.get_courier_review_queue() from anon;
revoke all on function public.get_courier_review_queue() from authenticated;
grant execute on function public.get_courier_review_queue() to authenticated;

revoke all on function public.review_courier_profile(uuid, text) from public;
revoke all on function public.review_courier_profile(uuid, text) from anon;
revoke all on function public.review_courier_profile(uuid, text) from authenticated;
grant execute on function public.review_courier_profile(uuid, text) to authenticated;

comment on function public.get_courier_review_queue() is
  'Cola administrativa de colaboradores. Requiere platform_admin global activo.';

comment on function public.review_courier_profile(uuid, text) is
  'Actualiza estado de colaborador y sincroniza el rol platform_courier. Requiere platform_admin global activo.';

do $verify$
begin
  if to_regprocedure('public.get_courier_review_queue()') is null then
    raise exception 'No se pudo crear public.get_courier_review_queue()';
  end if;

  if to_regprocedure('public.review_courier_profile(uuid,text)') is null then
    raise exception 'No se pudo crear public.review_courier_profile(uuid,text)';
  end if;

  if has_function_privilege('anon', 'public.get_courier_review_queue()', 'EXECUTE')
     or has_function_privilege('anon', 'public.review_courier_profile(uuid,text)', 'EXECUTE') then
    raise exception 'El rol anon conserva permisos de ejecucion indebidos';
  end if;

  if not has_function_privilege('authenticated', 'public.get_courier_review_queue()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.review_courier_profile(uuid,text)', 'EXECUTE') then
    raise exception 'El rol authenticated no recibio los permisos requeridos';
  end if;
end;
$verify$;

notify pgrst, 'reload schema';

commit;
