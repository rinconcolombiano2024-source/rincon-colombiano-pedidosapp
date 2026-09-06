-- RC ORDERA V91.0.4
-- Control conservador de carga para la cola de domicilios.
-- No activa trabajos cron desactivados y no elimina datos.

create or replace function public.rc_ordera_process_delivery_queue(p_limit integer default 20)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item record;
  v_processed integer := 0;
begin
  for v_item in
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
    limit greatest(least(coalesce(p_limit, 20), 20), 1)
    for update of co skip locked
  loop
    begin
      update public.delivery_assignments da
      set status = 'expired', updated_at = now()
      where da.customer_order_id = v_item.customer_order_id
        and da.status = 'offered'
        and da.offer_expires_at <= now();

      perform 1
      from public.rc_ordera_offer_next_courier(
        v_item.customer_order_id,
        v_item.restaurant_user_id
      )
      limit 1;

      v_processed := v_processed + 1;
    exception when others then
      insert into public.platform_audit_logs (
        actor_role,
        action,
        entity_type,
        entity_id,
        restaurant_user_id,
        metadata
      ) values (
        'system',
        'delivery_dispatch_failed',
        'customer_order',
        v_item.customer_order_id,
        v_item.restaurant_user_id,
        jsonb_build_object(
          'sqlstate', sqlstate,
          'message', left(sqlerrm, 500)
        )
      );
    end;
  end loop;

  return v_processed;
end;
$$;

revoke all on function public.rc_ordera_process_delivery_queue(integer)
from public, anon, authenticated;

-- Ajusta frecuencia y lote sin cambiar active. Si el trabajo está desactivado,
-- permanece desactivado después de ejecutar esta migración.
do $schedule$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for v_job_id in
      select jobid
      from cron.job
      where jobname = 'rc-ordera-delivery-dispatch-v83'
    loop
      perform cron.alter_job(
        v_job_id,
        schedule => '*/2 * * * *',
        command => 'select public.rc_ordera_process_delivery_queue(20);'
      );
    end loop;
  end if;
exception when others then
  raise notice 'No fue posible ajustar el cron de domicilios: %', sqlerrm;
end;
$schedule$;

notify pgrst, 'reload schema';
