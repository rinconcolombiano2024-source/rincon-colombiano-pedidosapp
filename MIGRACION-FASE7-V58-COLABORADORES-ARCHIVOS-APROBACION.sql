-- Fase 7 / v58
-- Colaboradores: archivos privados, reenvio de verificacion en app y aprobacion manual.
-- Ejecutar en Supabase SQL Editor una sola vez.

alter table public.courier_profiles
  add column if not exists identity_document_url text not null default '',
  add column if not exists driver_license_url text not null default '',
  add column if not exists insurance_url text not null default '';

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

grant execute on function public.user_can_review_couriers() to authenticated;
grant execute on function public.platform_owner_email() to authenticated;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.get_courier_review_queue() to authenticated;
grant execute on function public.review_courier_profile(uuid, text) to authenticated;
