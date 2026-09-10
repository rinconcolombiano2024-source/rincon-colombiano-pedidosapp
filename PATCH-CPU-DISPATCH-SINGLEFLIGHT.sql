-- RC ORDERA: parche exclusivo de CPU/SQL, sin activar ni reprogramar cron.
-- Ejecutar como propietario de la funcion (por ejemplo postgres), primero en pruebas.
-- Si la definicion instalada es diferente, ABORTA sin reemplazarla.
-- No ejecutar la migracion V91-04 completa para aplicar solamente este parche.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';

do $preflight$
declare
  v_body text;
  v_hash text;
begin
  select p.prosrc into v_body
  from pg_catalog.pg_proc p
  where p.oid = pg_catalog.to_regprocedure('public.rc_ordera_process_delivery_queue(integer)');

  if v_body is null then
    raise exception 'Falta rc_ordera_process_delivery_queue(integer). Parche no aplicado.';
  end if;

  v_hash := pg_catalog.md5(
    pg_catalog.btrim(pg_catalog.regexp_replace(v_body, '\s+', ' ', 'g'))
  );
  if v_hash not in (
    '377a2fcb7d4a0b8c34575889c3f4a0fb', -- cuerpo V91-04 original
    '82a643d8fde7d48221b134a59c7c3987' -- cuerpo con este parche (reaplicacion segura)
  ) then
    raise exception 'La cola instalada difiere de la base comprobada. Parche no aplicado.'
      using hint = 'Conservar la definicion instalada y revisar pg_get_functiondef antes de continuar.';
  end if;
end;
$preflight$;

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
  -- Evita lotes simultaneos sin esperar ni modificar pedidos si esta ocupado.
  if not pg_catalog.pg_try_advisory_xact_lock(9104, 8301) then
    return 0;
  end if;

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

-- CREATE OR REPLACE mantiene propietario y permisos existentes.
notify pgrst, 'reload schema';
commit;
