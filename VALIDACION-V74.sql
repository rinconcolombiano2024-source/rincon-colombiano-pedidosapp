-- RC ORDERA V74 - consultas de validacion de solo lectura.
-- Ejecutar despues de la migracion V74.

select
  to_regprocedure('public.review_courier_profile(uuid,text)') as review_courier_rpc,
  to_regprocedure('public.get_my_courier_approval()') as own_approval_rpc,
  to_regprocedure('public.confirm_current_restaurant_staff_invitation(text)') as staff_confirmation_rpc,
  to_regprocedure('public.prepare_current_restaurant_deletion()') as restaurant_deletion_rpc,
  to_regprocedure('public.protect_courier_review_fields()') as courier_protection_trigger_function;

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'review_courier_profile',
    'get_my_courier_approval',
    'confirm_current_restaurant_staff_invitation',
    'prepare_current_restaurant_deletion'
  )
order by routine_name, grantee;

select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'courier_profiles'
  and trigger_name = 'protect_courier_review_fields_trigger';

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
order by cp.updated_at desc;

-- Debe devolver cero filas. Detecta aprobaciones inconsistentes.
select cp.user_id, cp.status as profile_status, ur.status as role_status
from public.courier_profiles cp
left join public.user_roles ur
  on ur.user_id = cp.user_id
 and ur.role = 'platform_courier'
 and ur.scope_type = 'platform'
 and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
where (cp.status = 'approved' and coalesce(ur.status, '') <> 'active')
   or (cp.status <> 'approved' and ur.status = 'active');

-- Ninguna fila publica puede estar inactiva o eliminada.
select d.user_id, d.business_name, rp.active, rp.deleted_at
from public.get_public_restaurant_directory() d
join public.restaurant_profiles rp on rp.user_id = d.user_id
where rp.active is not true or rp.deleted_at is not null;

select
  count(*) filter (where active = true and deleted_at is null) as restaurantes_publicables,
  count(*) filter (where active = false or deleted_at is not null) as restaurantes_ocultos
from public.restaurant_profiles;

select
  i.restaurant_user_id,
  i.email,
  i.station,
  i.status,
  m.member_user_id,
  m.active as membership_active
from public.restaurant_staff_invitations i
left join public.restaurant_staff_memberships m
  on m.restaurant_user_id = i.restaurant_user_id
 and m.member_user_id = i.claimed_by_user_id
 and m.station = i.station
order by i.updated_at desc;

