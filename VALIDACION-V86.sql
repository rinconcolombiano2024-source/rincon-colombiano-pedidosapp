-- RC ORDERA V86.1 - validacion posterior al despliegue
-- Solo lectura: no modifica tablas, usuarios, roles ni datos.

select
  current_database() as database_name,
  now() as checked_at,
  to_regclass('public.order_ticket_reservations') is not null as ticket_integrity_ready,
  to_regclass('public.marketplace_settlement_jobs') is not null as settlement_queue_ready,
  to_regclass('public.restaurant_public_catalogs') is not null as public_catalog_ready,
  to_regclass('public.delivery_quotes') is not null as delivery_quotes_ready,
  to_regclass('public.public_content_translations') is not null as translation_cache_ready;

select
  to_regprocedure('public.accept_customer_order_atomic(uuid,uuid,text)') is not null as atomic_acceptance,
  to_regprocedure('public.get_current_restaurant_business_context()') is not null as restaurant_business_clock,
  to_regprocedure('public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)') is not null as secure_customer_order,
  to_regprocedure('public.list_current_restaurant_team()') is not null as station_team_list,
  to_regprocedure('public.confirm_current_restaurant_staff_invitation(text)') is not null as station_owner_confirmation,
  to_regprocedure('public.claim_my_restaurant_staff_invitation(uuid)') is not null as station_employee_claim,
  to_regprocedure('public.rc_ordera_finalize_restaurant_deletion(uuid)') is not null as atomic_restaurant_closure;

select
  restaurant_fee_bps,
  courier_fee_bps,
  restaurant_fee_bps = 500 as restaurant_fee_is_5_percent,
  courier_fee_bps = 10 as courier_fee_is_point_1_percent
from public.marketplace_finance_config
where id = true;

select
  has_function_privilege('anon', 'public.list_current_restaurant_team()', 'EXECUTE') as anon_can_list_station_team,
  has_function_privilege('authenticated', 'public.list_current_restaurant_team()', 'EXECUTE') as authenticated_can_list_station_team,
  has_function_privilege('anon', 'public.confirm_current_restaurant_staff_invitation(text)', 'EXECUTE') as anon_can_confirm_station,
  has_function_privilege('authenticated', 'public.confirm_current_restaurant_staff_invitation(text)', 'EXECUTE') as authenticated_can_confirm_station;

-- Debe devolver cero filas.
select user_id, business_date, ticket_number, count(*) as duplicates
from public.orders
group by user_id, business_date, ticket_number
having count(*) > 1;

-- Debe devolver cero filas: un pedido no puede tener dos asignaciones activas.
select customer_order_id, count(*) as active_assignments
from public.delivery_assignments
where status in ('offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
group by customer_order_id
having count(*) > 1;

-- Debe devolver cero filas: restaurantes eliminados o inactivos no son publicos.
select c.restaurant_user_id
from public.restaurant_public_catalogs c
join public.restaurant_profiles r on r.user_id = c.restaurant_user_id
where c.active = true
  and (r.active = false or r.deleted_at is not null);

select id, name, public
from storage.buckets
where id = 'courier-documents';

select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('customer_orders', 'restaurant_public_catalogs', 'delivery_assignments', 'notifications')
order by tablename;

select status, count(*) as jobs
from public.marketplace_settlement_jobs
group by status
order by status;

select processing_status, count(*) as provider_events
from public.payment_provider_events
group by processing_status
order by processing_status;
