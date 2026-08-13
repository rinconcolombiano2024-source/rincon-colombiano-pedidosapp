-- RC ORDERA V84.1 - VALIDACION POSTERIOR SOLO LECTURA
-- Ejecutar despues de la migracion y conservar el resultado en el reporte de despliegue.

do $validate$
begin
  if to_regprocedure('public.get_customer_order_tracking(uuid,text)') is null then
    raise exception 'Falta get_customer_order_tracking(uuid,text)';
  end if;
  if to_regprocedure('public.get_current_restaurant_delivery_tracking()') is null then
    raise exception 'Falta get_current_restaurant_delivery_tracking()';
  end if;
  if to_regprocedure('public.get_my_courier_delivery_history()') is null then
    raise exception 'Falta get_my_courier_delivery_history()';
  end if;
  if to_regprocedure('public.set_courier_availability(boolean)') is null then
    raise exception 'Falta set_courier_availability(boolean)';
  end if;
  if to_regprocedure('public.upsert_courier_live_location(boolean,numeric,numeric,integer)') is null then
    raise exception 'Falta upsert_courier_live_location';
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'courier_live_locations'
      and policyname = 'Active order participants read courier live location'
  ) then
    raise exception 'Falta la politica de seguimiento autorizado';
  end if;
  if exists (
    select 1
    from public.delivery_assignments da
    where da.status in ('offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
    group by da.customer_order_id
    having count(*) > 1
  ) then
    raise exception 'Persisten asignaciones activas duplicadas';
  end if;
end;
$validate$;

select
  has_function_privilege('anon', 'public.get_customer_order_tracking(uuid,text)', 'EXECUTE') as anon_can_read_by_secret_token,
  has_function_privilege('authenticated', 'public.get_customer_order_tracking(uuid,text)', 'EXECUTE') as customer_can_track,
  has_function_privilege('authenticated', 'public.get_current_restaurant_delivery_tracking()', 'EXECUTE') as restaurant_can_track,
  has_function_privilege('anon', 'public.set_courier_availability(boolean)', 'EXECUTE') as anon_cannot_change_availability,
  has_function_privilege('authenticated', 'public.set_courier_availability(boolean)', 'EXECUTE') as courier_can_change_own_availability;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'delivery_assignments_one_active_order_v841_idx',
    'courier_live_locations_v841_dispatch_idx'
  )
order by indexname;

select
  policyname,
  cmd,
  roles,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'courier_live_locations'
order by policyname;

select
  p.proname,
  p.prosecdef as security_definer,
  p.proconfig,
  position('else public.courier_live_locations.available' in lower(pg_get_functiondef(p.oid))) > 0
    as gps_preserves_explicit_availability,
  position('available = false' in lower(pg_get_functiondef(p.oid))) > 0
    as function_contains_explicit_offline_write
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_courier_availability',
    'upsert_courier_live_location',
    'update_delivery_assignment_status',
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
  count(*) filter (where available) as couriers_online,
  count(*) filter (where not available) as couriers_offline,
  count(*) filter (where available and coalesce(last_location_at, updated_at) < now() - interval '15 minutes')
    as online_with_stale_location
from public.courier_live_locations;

select
  exists (select 1 from pg_extension where extname = 'pg_cron') as pg_cron_installed,
  to_regclass('cron.job') is not null as cron_job_table_available,
  'Si pg_cron no esta instalado, programa delivery-dispatch externamente una vez por minuto.'::text as instruction;

