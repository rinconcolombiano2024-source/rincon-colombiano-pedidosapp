-- RC ORDERA V75 - validaciones de solo lectura
-- Ejecutar despues de MIGRACION-FASE1-V75-ESTADO-HORARIO-AUTORIZACIONES.sql.

select
  column_name,
  data_type,
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'restaurant_profiles'
  and column_name = 'operational_mode';

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
  union all
  select 'sabado despues del cierre nocturno', false,
    public.restaurant_schedule_is_open(hours, 'Europe/Warsaw', '2026-08-15 03:00:00+02'::timestamptz)
  from schedule
)
select label, expected, actual, expected = actual as passed
from checks
order by label;

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'restaurant_schedule_is_open',
    'set_current_restaurant_operational_open',
    'set_current_restaurant_operational_mode',
    'sync_current_restaurant_operational_status',
    'list_current_restaurant_team',
    'review_courier_profile',
    'get_courier_review_result'
  )
order by routine_name;

select
  has_function_privilege('authenticated', 'public.set_current_restaurant_operational_mode(text)', 'EXECUTE') as authenticated_can_change_mode,
  has_function_privilege('authenticated', 'public.sync_current_restaurant_operational_status()', 'EXECUTE') as authenticated_can_sync_own_restaurant,
  has_function_privilege('anon', 'public.set_current_restaurant_operational_mode(text)', 'EXECUTE') as anon_can_change_mode,
  has_function_privilege('anon', 'public.get_courier_review_result(uuid)', 'EXECUTE') as anon_can_review_courier;

select
  rp.user_id,
  rp.business_name,
  rp.active,
  rp.operational_mode,
  rp.operational_open,
  rp.timezone,
  rp.opening_hours,
  rp.updated_at
from public.restaurant_profiles rp
where rp.deleted_at is null
order by rp.updated_at desc;

-- Debe devolver cero filas: invitaciones reclamadas sin membresia activa equivalente.
select
  i.restaurant_user_id,
  i.email,
  i.station,
  i.claimed_by_user_id,
  i.claimed_at
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

-- Debe devolver cero filas: perfil y rol de colaborador en estados incompatibles.
select
  cp.user_id,
  cp.status as profile_status,
  ur.status as role_status,
  cp.reviewed_at,
  cp.reviewed_by_user_id
from public.courier_profiles cp
left join public.user_roles ur
  on ur.user_id = cp.user_id
 and ur.role = 'platform_courier'
 and ur.scope_type = 'platform'
 and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
where (cp.status = 'approved' and coalesce(ur.status, '') <> 'active')
   or (coalesce(ur.status, '') = 'active' and cp.status <> 'approved');

select * from public.get_public_restaurant_directory();
