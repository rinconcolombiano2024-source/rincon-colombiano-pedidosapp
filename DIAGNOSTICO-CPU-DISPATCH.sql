-- Solo diagnostico: no ejecuta dispatch, no cambia cron y no crea indices.
-- Ejecutar en Supabase SQL Editor. EXPLAIN ANALYZE ejecuta este SELECT,
-- no rc_ordera_process_delivery_queue ni sus escrituras.
-- Se omite FOR UPDATE: se mide la seleccion sin bloquear pedidos.
-- Si hay timeout, hacer ROLLBACK antes de otra consulta.
begin read only;
set local statement_timeout = '8s';

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('customer_orders', 'delivery_assignments')
order by tablename, indexname;

explain (analyze, buffers, timing off, format json)
select co.id as customer_order_id, co.user_id as restaurant_user_id
from public.customer_orders co
where co.order_type = 'Domicilio'
  and co.created_at >= now() - interval '24 hours'
  and co.status not in ('delivered', 'cancelled')
  and co.station_status not in ('completed', 'cancelled')
  and co.courier_assignment_status in ('unassigned', 'rejected', 'expired', 'no_courier', 'offered')
  and (
    co.courier_assignment_status = 'unassigned'
    or co.updated_at is null
    or co.updated_at <= now() - interval '2 minutes'
  )
  and not exists (
    select 1
    from public.delivery_assignments active_da
    where active_da.customer_order_id = co.id
      and (
        active_da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
        or (active_da.status = 'offered' and active_da.offer_expires_at > now())
      )
  )
order by co.created_at asc
limit 20;

rollback;
