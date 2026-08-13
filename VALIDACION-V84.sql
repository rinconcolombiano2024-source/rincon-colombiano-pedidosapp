-- RC ORDERA V84 - validacion de estructura y permisos.
-- Es de solo lectura. Ejecutar despues de V82, V83 y V84.

select
  to_regprocedure('public.set_courier_availability(boolean)') as disponibilidad_explicita,
  to_regprocedure('public.rc_ordera_process_delivery_queue(integer)') as motor_despacho,
  to_regprocedure('public.process_delivery_dispatch_queue(integer)') as rpc_despacho_programado,
  to_regprocedure('public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)') as pedido_seguro,
  to_regprocedure('public.toggle_customer_favorite(uuid,text,text)') as favorito_cliente,
  to_regprocedure('public.get_customer_order_timeline(uuid,text)') as linea_de_tiempo_cliente,
  to_regprocedure('public.submit_customer_review(uuid,integer,integer,integer,integer,text)') as resena_cliente,
  to_regprocedure('public.create_support_ticket(uuid,text,text,text)') as incidencia_segura;

select t.table_name, c.relrowsecurity as row_security
from information_schema.tables t
join pg_catalog.pg_class c on c.relname = t.table_name
join pg_catalog.pg_namespace n on n.oid = c.relnamespace and n.nspname = t.table_schema
where t.table_schema = 'public'
  and t.table_name in (
    'order_status_history', 'platform_audit_logs', 'notifications',
    'courier_push_subscriptions', 'customer_addresses', 'customer_favorites',
    'modifier_groups', 'modifiers', 'product_modifier_groups',
    'product_availability_overrides', 'restaurant_special_hours', 'promotions',
    'reviews', 'support_tickets', 'support_messages',
    'loyalty_accounts', 'loyalty_transactions', 'rewards',
    'payment_transactions', 'refund_transactions', 'courier_settlements'
  )
order by table_name;

select
  has_function_privilege('anon', 'public.set_courier_availability(boolean)', 'EXECUTE') as anon_cambia_disponibilidad,
  has_function_privilege('authenticated', 'public.set_courier_availability(boolean)', 'EXECUTE') as colaborador_invoca_disponibilidad,
  has_function_privilege('anon', 'public.process_delivery_dispatch_queue(integer)', 'EXECUTE') as anon_procesa_despacho,
  has_function_privilege('authenticated', 'public.process_delivery_dispatch_queue(integer)', 'EXECUTE') as autenticado_puede_invocar_rpc_protegida,
  has_function_privilege('anon', 'public.toggle_customer_favorite(uuid,text,text)', 'EXECUTE') as anon_cambia_favoritos,
  has_function_privilege('authenticated', 'public.toggle_customer_favorite(uuid,text,text)', 'EXECUTE') as cliente_cambia_favoritos;

select
  has_table_privilege('authenticated', 'public.customer_orders', 'INSERT') as insercion_directa_pedido,
  has_table_privilege('authenticated', 'public.payment_transactions', 'INSERT') as pago_directo_frontend,
  has_table_privilege('authenticated', 'public.refund_transactions', 'INSERT') as reembolso_directo_frontend,
  has_table_privilege('authenticated', 'public.loyalty_transactions', 'INSERT') as puntos_directos_frontend;

select
  count(*) filter (where available) as colaboradores_en_linea,
  count(*) filter (where available and coalesce(last_location_at, updated_at) < now() - interval '2 minutes') as en_linea_gps_antiguo,
  count(*) filter (where not available) as no_disponibles
from public.courier_live_locations;

select status, count(*)
from public.delivery_assignments
group by status
order by status;

select
  count(*) as pedidos_sin_historial
from public.customer_orders co
where not exists (
  select 1 from public.order_status_history osh where osh.customer_order_id = co.id
);

select pubname, tablename
from pg_catalog.pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in (
    'app_settings', 'restaurant_profiles', 'customer_orders',
    'delivery_assignments', 'notifications', 'order_status_history',
    'product_availability_overrides', 'support_messages'
  )
order by tablename;

select exists (
  select 1 from pg_extension where extname = 'pg_cron'
) as pg_cron_instalado;

-- Si pg_cron_instalado devuelve true, comprueba tambien:
-- select jobid, jobname, schedule, active
-- from cron.job where jobname = 'rc-ordera-delivery-dispatch-v83';
