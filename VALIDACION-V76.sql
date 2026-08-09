-- RC ORDERA V76 - validaciones de solo lectura
-- Ejecutar despues de MIGRACION-FASE1-V76-REGION-AUTORIZACIONES-IMPRESION.sql.
-- Este archivo no modifica ni elimina datos.

-- 1. Debe devolver 16 filas, una por cada columna regional agregada o confirmada.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('restaurant_profiles', 'country_code'),
    ('restaurant_profiles', 'city'),
    ('restaurant_profiles', 'region'),
    ('restaurant_profiles', 'postal_code'),
    ('restaurant_profiles', 'latitude'),
    ('restaurant_profiles', 'longitude'),
    ('user_profiles', 'country_code'),
    ('user_profiles', 'city'),
    ('user_profiles', 'region'),
    ('user_profiles', 'postal_code'),
    ('courier_profiles', 'country_code'),
    ('courier_profiles', 'city'),
    ('courier_profiles', 'region'),
    ('courier_profiles', 'postal_code'),
    ('courier_live_locations', 'country_code'),
    ('courier_live_locations', 'region')
  )
order by table_name, column_name;

-- 2. Todas las funciones deben aparecer con su firma.
select unnest(array[
  to_regprocedure('public.get_public_restaurant_directory_by_region(text,text,text)'),
  to_regprocedure('public.invite_current_restaurant_staff(text,text,text)'),
  to_regprocedure('public.confirm_current_restaurant_staff_invitation(text)'),
  to_regprocedure('public.claim_my_restaurant_staff_invitation(uuid)'),
  to_regprocedure('public.get_courier_review_queue()'),
  to_regprocedure('public.review_courier_profile(uuid,text)'),
  to_regprocedure('public.get_my_courier_approval()'),
  to_regprocedure('public.get_courier_review_result(uuid)'),
  to_regprocedure('public.upsert_courier_live_location(boolean,numeric,numeric,integer)'),
  to_regprocedure('public.assign_nearest_courier(uuid)'),
  to_regprocedure('public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)')
]) as installed_function;

-- 3. Los permisos privados deben ser true para authenticated y false para anon.
select
  has_function_privilege('authenticated', 'public.confirm_current_restaurant_staff_invitation(text)', 'EXECUTE') as authenticated_can_confirm_staff,
  has_function_privilege('authenticated', 'public.get_courier_review_queue()', 'EXECUTE') as authenticated_can_call_admin_queue,
  has_function_privilege('authenticated', 'public.review_courier_profile(uuid,text)', 'EXECUTE') as authenticated_can_call_review,
  has_function_privilege('anon', 'public.confirm_current_restaurant_staff_invitation(text)', 'EXECUTE') as anon_can_confirm_staff,
  has_function_privilege('anon', 'public.get_courier_review_queue()', 'EXECUTE') as anon_can_call_admin_queue,
  has_function_privilege('anon', 'public.review_courier_profile(uuid,text)', 'EXECUTE') as anon_can_call_review;

-- 4. Todas las pruebas de horario deben mostrar passed = true.
with schedule as (
  select '{
    "monday":{"enabled":true,"open":"09:00","close":"22:00"},
    "friday":{"enabled":true,"open":"18:00","close":"02:00"}
  }'::jsonb as hours
), checks(label, expected, actual) as (
  select 'lunes dentro del horario', true,
    public.restaurant_schedule_is_open(hours, 'Europe/Warsaw', '2026-08-10 10:00:00+02'::timestamptz)
  from schedule
  union all
  select 'lunes antes de abrir', false,
    public.restaurant_schedule_is_open(hours, 'Europe/Warsaw', '2026-08-10 08:00:00+02'::timestamptz)
  from schedule
  union all
  select 'viernes turno nocturno', true,
    public.restaurant_schedule_is_open(hours, 'Europe/Warsaw', '2026-08-14 23:00:00+02'::timestamptz)
  from schedule
  union all
  select 'sabado continuacion nocturna', true,
    public.restaurant_schedule_is_open(hours, 'Europe/Warsaw', '2026-08-15 01:00:00+02'::timestamptz)
  from schedule
)
select label, expected, actual, expected = actual as passed
from checks
order by label;

-- 5. Debe devolver cero filas: un restaurante eliminado nunca puede seguir publico.
select user_id, business_name, active, operational_open, deleted_at
from public.restaurant_profiles
where deleted_at is not null and (active = true or operational_open = true);

-- 6. Revise cualquier fila: son posibles duplicados reales, no se borran automaticamente.
select
  lower(trim(business_name)) as normalized_name,
  lower(trim(public_address)) as normalized_address,
  count(*) as active_records,
  array_agg(user_id order by updated_at desc) as restaurant_ids
from public.restaurant_profiles
where active = true and deleted_at is null
group by lower(trim(business_name)), lower(trim(public_address))
having count(*) > 1;

-- 7. Debe devolver cero filas: invitacion reclamada sin membresia activa equivalente.
select i.restaurant_user_id, i.email, i.station, i.claimed_by_user_id
from public.restaurant_staff_invitations i
where i.status = 'claimed'
  and not exists (
    select 1
    from public.restaurant_staff_memberships m
    where m.restaurant_user_id = i.restaurant_user_id
      and m.member_user_id = i.claimed_by_user_id
      and m.station = i.station
      and m.active = true
  );

-- 8. Debe devolver cero filas: membresia activa sin rol activo del mismo restaurante.
select m.restaurant_user_id, m.member_user_id, m.station, m.active
from public.restaurant_staff_memberships m
where m.active = true
  and not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = m.member_user_id
      and ur.role = 'restaurant_employee'
      and ur.scope_type = 'restaurant'
      and ur.scope_id = m.restaurant_user_id
      and ur.status = 'active'
  );

-- 9. Debe devolver cero filas: aprobacion del colaborador y rol incompatibles.
select cp.user_id, cp.status as profile_status, ur.status as role_status,
       cp.reviewed_at, cp.reviewed_by_user_id
from public.courier_profiles cp
left join public.user_roles ur
  on ur.user_id = cp.user_id
 and ur.role = 'platform_courier'
 and ur.scope_type = 'platform'
 and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
where (cp.status = 'approved' and coalesce(ur.status, '') <> 'active')
   or (coalesce(ur.status, '') = 'active' and cp.status <> 'approved');

-- 10. Muestra los restaurantes activos que aun necesitan completar su region.
select user_id, business_name, country_code, city, region, postal_code, public_address
from public.restaurant_profiles
where active = true and deleted_at is null
  and (trim(country_code) = '' or trim(city) = '' or trim(region) = '' or trim(public_address) = '')
order by business_name;

-- 11. Directorios regionales. Solo deben aparecer restaurantes activos del pais indicado.
select * from public.get_public_restaurant_directory_by_region('PL', 'Warszawa', 'Mazowieckie');
select * from public.get_public_restaurant_directory_by_region('CO', 'Bogota', 'Bogota D.C.');
