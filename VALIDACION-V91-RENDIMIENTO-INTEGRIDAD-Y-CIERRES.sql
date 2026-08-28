-- RC ORDERA V91 - Validacion de instalacion
-- Solo lectura. No modifica datos.

select
  public.get_rc_ordera_schema_version() as version_instalada;

select
  to_regprocedure('public.get_rc_ordera_schema_version()') is not null as version_rpc_ok,
  to_regprocedure('public.void_restaurant_order(uuid,text)') is not null as anulacion_rpc_ok,
  to_regprocedure('public.get_restaurant_closure_report(text,text)') is not null as cierres_rpc_ok,
  to_regprocedure('public.get_courier_delivery_offers()') is not null as ofertas_rpc_ok,
  to_regprocedure('public.process_expired_delivery_offers(integer)') is not null as mantenimiento_ofertas_rpc_ok,
  to_regprocedure('public.update_delivery_assignment_status(uuid,text)') is not null as entrega_atomica_rpc_ok;

select
  count(*) filter (where column_name = 'status') = 1 as orders_status_ok,
  count(*) filter (where column_name = 'canonical_status') = 1 as orders_canonical_status_ok,
  count(*) filter (where column_name = 'cancelled_at') = 1 as orders_cancelled_at_ok,
  count(*) filter (where column_name = 'cancelled_by') = 1 as orders_cancelled_by_ok,
  count(*) filter (where column_name = 'cancellation_reason') = 1 as orders_cancellation_reason_ok
from information_schema.columns
where table_schema = 'public' and table_name = 'orders';

select
  has_function_privilege('authenticated', 'public.get_rc_ordera_schema_version()', 'EXECUTE') as authenticated_version_ok,
  has_function_privilege('authenticated', 'public.void_restaurant_order(uuid,text)', 'EXECUTE') as authenticated_anulacion_ok,
  has_function_privilege('authenticated', 'public.get_restaurant_closure_report(text,text)', 'EXECUTE') as authenticated_cierres_ok,
  not has_function_privilege('anon', 'public.void_restaurant_order(uuid,text)', 'EXECUTE') as anon_anulacion_bloqueada,
  not has_function_privilege('anon', 'public.get_restaurant_closure_report(text,text)', 'EXECUTE') as anon_cierres_bloqueados,
  not has_function_privilege('authenticated', 'public.process_expired_delivery_offers(integer)', 'EXECUTE') as mantenimiento_restringido;

select public.get_restaurant_closure_report('day', to_char(current_date, 'YYYY-MM-DD')) as cierre_hoy;

-- Resultado esperado:
-- 1. Version instalada contiene schema_version = 91.
-- 2. Todas las columnas y funciones aparecen en true.
-- 3. cierre_hoy devuelve un objeto JSON, aunque no existan ventas.
