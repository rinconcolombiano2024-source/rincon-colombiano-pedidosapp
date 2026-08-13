-- RC ORDERA V84.1 - PREFLIGHT SOLO LECTURA
-- Ejecutar antes de MIGRACION-V84.1-ESTABILIZACION-PRODUCCION.sql.
-- No modifica tablas, datos, funciones, politicas ni usuarios.

select
  current_database() as database_name,
  now() as checked_at,
  current_user as execution_role;

with required_objects(kind, object_name, present) as (
  values
    ('table', 'public.customer_orders', to_regclass('public.customer_orders') is not null),
    ('table', 'public.courier_profiles', to_regclass('public.courier_profiles') is not null),
    ('table', 'public.courier_live_locations', to_regclass('public.courier_live_locations') is not null),
    ('table', 'public.delivery_assignments', to_regclass('public.delivery_assignments') is not null),
    ('table', 'public.notifications', to_regclass('public.notifications') is not null),
    ('table', 'public.order_status_history', to_regclass('public.order_status_history') is not null),
    ('function', 'public.rc_ordera_is_platform_admin(uuid)', to_regprocedure('public.rc_ordera_is_platform_admin(uuid)') is not null),
    ('function', 'public.rc_ordera_can_manage_restaurant(uuid,text)', to_regprocedure('public.rc_ordera_can_manage_restaurant(uuid,text)') is not null),
    ('function', 'public.set_courier_availability(boolean)', to_regprocedure('public.set_courier_availability(boolean)') is not null),
    ('function', 'public.upsert_courier_live_location(boolean,numeric,numeric,integer)', to_regprocedure('public.upsert_courier_live_location(boolean,numeric,numeric,integer)') is not null),
    ('function', 'public.get_my_courier_delivery_history()', to_regprocedure('public.get_my_courier_delivery_history()') is not null),
    ('function', 'public.process_delivery_dispatch_queue(integer)', to_regprocedure('public.process_delivery_dispatch_queue(integer)') is not null)
)
select * from required_objects order by kind, object_name;

select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and (
    (c.table_name = 'customer_orders' and c.column_name in (
      'canonical_status', 'public_token', 'customer_user_id',
      'assigned_courier_user_id', 'courier_assignment_status',
      'estimated_pickup_at', 'estimated_delivery_at'
    ))
    or
    (c.table_name = 'courier_live_locations' and c.column_name in (
      'available', 'lat', 'lng', 'available_since', 'last_location_at', 'updated_at'
    ))
    or
    (c.table_name = 'delivery_assignments' and c.column_name in (
      'customer_order_id', 'courier_user_id', 'status', 'offer_expires_at',
      'estimated_pickup_at', 'estimated_delivery_at'
    ))
  )
order by c.table_name, c.ordinal_position;

select
  da.customer_order_id,
  count(*) as active_assignment_count,
  array_agg(da.id order by da.updated_at desc) as assignment_ids
from public.delivery_assignments da
where da.status in ('offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
group by da.customer_order_id
having count(*) > 1;

select
  da.id,
  da.customer_order_id,
  da.courier_user_id
from public.delivery_assignments da
left join public.customer_orders co on co.id = da.customer_order_id
left join auth.users courier_user on courier_user.id = da.courier_user_id
where co.id is null or courier_user.id is null;

select
  n.recipient_user_id,
  n.notification_type,
  n.reference_id,
  count(*) as duplicate_count
from public.notifications n
where n.reference_id is not null
group by n.recipient_user_id, n.notification_type, n.reference_id
having count(*) > 1;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'customer_orders', 'courier_profiles', 'courier_live_locations',
    'delivery_assignments', 'notifications', 'order_status_history'
  )
order by c.relname;

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  position('available = false' in lower(pg_get_functiondef(p.oid))) > 0 as writes_offline,
  position('courier_live_locations' in lower(pg_get_functiondef(p.oid))) > 0 as touches_live_location
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_courier_availability',
    'upsert_courier_live_location',
    'update_delivery_assignment_status',
    'review_courier_profile',
    'rc_ordera_process_delivery_queue'
  )
order by p.proname;

select
  pt.tablename,
  true as realtime_enabled
from pg_publication_tables pt
where pt.pubname = 'supabase_realtime'
  and pt.schemaname = 'public'
  and pt.tablename in (
    'customer_orders', 'delivery_assignments', 'courier_live_locations',
    'notifications', 'order_status_history'
  )
order by pt.tablename;

select
  exists (select 1 from pg_extension where extname = 'pg_cron') as pg_cron_installed,
  to_regclass('cron.job') is not null as cron_job_table_available,
  'Si pg_cron no esta instalado, programa delivery-dispatch externamente una vez por minuto.'::text as instruction;

