-- RC ORDERA V91-28
-- P1: impedir saltos y retrocesos entre Empaque y Despacho.
-- Objetivo:
--   1) Un pedido con tarea activa de Empaque NO puede despacharse desde READY.
--   2) Empaque NO puede cambiar un pedido que ya salio de READY.
--   3) Despacho solo ve PACKED/DISPATCHED, salvo READY de pedidos legacy sin tarea activa de Empaque.
--   4) Mantener compatibilidad con pedidos legacy que no tengan order_station_tasks de packing.
-- No borra datos, no toca importes, pagos, menu ni historicos.

begin;
set local lock_timeout = '5s';

-- Preflight: abortar antes de tocar nada si el contrato esperado no existe.
do $preflight$
declare
  v_proc regprocedure;
  v_def text;
  v_signature text;
begin
  if to_regprocedure('public.update_my_station_order(uuid,uuid,text,text)') is null then
    raise exception 'V91-28: falta public.update_my_station_order(uuid,uuid,text,text).';
  end if;

  foreach v_signature in array array[
    'public.list_my_station_orders(uuid,text)',
    'public.list_my_station_orders(uuid,text,uuid[])'
  ] loop
    v_proc := to_regprocedure(v_signature);
    if v_proc is null then
      raise exception 'V91-28: falta %.', v_signature;
    end if;

    select replace(pg_get_functiondef(v_proc), E'\r\n', E'\n') into v_def;

    if position('and co.status in (''accepted'', ''sent'')' in v_def) = 0
       or position('and co.station_status not in (''completed'', ''cancelled'')' in v_def) = 0 then
      raise exception 'V91-28: contrato de lectura de estaciones inesperado en %.', v_signature;
    end if;
  end loop;
end;
$preflight$;

-- Máquina de estados reforzada.
create or replace function public.update_my_station_order(
  p_restaurant_user_id uuid,
  p_order_id uuid,
  p_next_station_status text,
  p_station text
)
returns table(
  order_id uuid,
  order_status text,
  station_status text,
  updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_member_id uuid := auth.uid();
  v_station text := lower(trim(coalesce(p_station, '')));
  v_next text := lower(trim(coalesce(p_next_station_status, '')));
  v_current text;
  v_order_status text;
  v_order_station_status text;
begin
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_station not in (
    'waiter', 'cashier', 'manager', 'kitchen', 'grill', 'drinks',
    'fast_food', 'starters', 'salads', 'packing', 'dispatch'
  ) then
    raise exception 'Invalid station';
  end if;

  if not exists (
    select 1
    from public.restaurant_staff_memberships m
    where m.restaurant_user_id = p_restaurant_user_id
      and m.member_user_id = v_member_id
      and m.station = v_station
      and m.active = true
  ) then
    raise exception 'Station is not authorized';
  end if;

  select co.status, co.station_status
  into v_order_status, v_order_station_status
  from public.customer_orders co
  where co.id = p_order_id
    and co.user_id = p_restaurant_user_id
  for update;

  if not found or v_order_status not in ('accepted', 'sent') then
    raise exception 'Order is not active';
  end if;

  if v_station in (
    'kitchen', 'grill', 'drinks',
    'fast_food', 'starters', 'salads', 'packing'
  ) then

    select task.status
    into v_current
    from public.order_station_tasks task
    where task.customer_order_id = p_order_id
      and task.restaurant_user_id = p_restaurant_user_id
      and task.station = v_station
    for update;

    if not found then
      raise exception 'Station task was not found';
    end if;

    if v_station = 'packing' then
      -- Empaque solo puede actuar cuando TODA preparacion termino y el pedido global esta READY.
      if v_next <> 'packed'
         or v_current <> 'received'
         or v_order_station_status <> 'ready' then
        raise exception 'Station transition is not allowed';
      end if;

      if exists (
        select 1
        from public.order_station_tasks t
        where t.customer_order_id = p_order_id
          and t.restaurant_user_id = p_restaurant_user_id
          and t.station <> 'packing'
          and t.status not in ('ready', 'cancelled')
      ) then
        raise exception 'Station transition is not allowed';
      end if;

      update public.order_station_tasks
      set
        status = 'packed',
        completed_at = now(),
        updated_at = now()
      where customer_order_id = p_order_id
        and restaurant_user_id = p_restaurant_user_id
        and station = 'packing'
        and status = 'received';

      if not found then
        raise exception 'Station transition is not allowed';
      end if;

      update public.customer_orders
      set
        station_status = 'packed',
        updated_at = now()
      where id = p_order_id
        and user_id = p_restaurant_user_id
        and station_status = 'ready';

      if not found then
        raise exception 'Station transition is not allowed';
      end if;

    else

      if not (
        (v_current = 'received' and v_next = 'preparing')
        or
        (v_current = 'preparing' and v_next = 'ready')
      ) then
        raise exception 'Station transition is not allowed';
      end if;

      update public.order_station_tasks
      set
        status = v_next,
        started_at =
          case
            when v_next = 'preparing'
              then coalesce(started_at, now())
            else started_at
          end,
        completed_at =
          case
            when v_next = 'ready'
              then now()
            else completed_at
          end,
        updated_at = now()
      where customer_order_id = p_order_id
        and restaurant_user_id = p_restaurant_user_id
        and station = v_station;

      if not exists (
        select 1
        from public.order_station_tasks t
        where t.customer_order_id = p_order_id
          and t.restaurant_user_id = p_restaurant_user_id
          and t.station <> 'packing'
          and t.status not in ('ready', 'cancelled')
      ) then

        update public.order_station_tasks
        set
          status = 'received',
          updated_at = now()
        where customer_order_id = p_order_id
          and restaurant_user_id = p_restaurant_user_id
          and station = 'packing'
          and status = 'blocked';

        update public.customer_orders
        set
          station_status = 'ready',
          updated_at = now()
        where id = p_order_id
          and user_id = p_restaurant_user_id;

      else

        update public.customer_orders
        set
          station_status = 'preparing',
          updated_at = now()
        where id = p_order_id
          and user_id = p_restaurant_user_id;

      end if;
    end if;

  elsif v_station = 'dispatch' then

    if v_next = 'dispatched' then

      -- Flujo normal: PACKED -> DISPATCHED.
      -- Compatibilidad legacy: READY -> DISPATCHED solo cuando NO existe tarea activa de Empaque.
      update public.customer_orders as co_dispatch
      set
        station_status = 'dispatched',
        status = 'sent',
        updated_at = now()
      where co_dispatch.id = p_order_id
        and co_dispatch.user_id = p_restaurant_user_id
        and (
          co_dispatch.station_status = 'packed'
          or (
            co_dispatch.station_status = 'ready'
            and not exists (
              select 1
              from public.order_station_tasks packing_task
              where packing_task.customer_order_id = co_dispatch.id
                and packing_task.restaurant_user_id = p_restaurant_user_id
                and packing_task.station = 'packing'
                and packing_task.status <> 'cancelled'
            )
          )
        );

    elsif v_next = 'completed' then

      update public.customer_orders as co_dispatch
      set
        station_status = 'completed',
        status = 'delivered',
        updated_at = now()
      where co_dispatch.id = p_order_id
        and co_dispatch.user_id = p_restaurant_user_id
        and co_dispatch.station_status = 'dispatched';

    else
      raise exception 'Station transition is not allowed';
    end if;

    if not found then
      raise exception 'Station transition is not allowed';
    end if;

  elsif v_station not in ('manager', 'cashier') then

    raise exception 'Station transition is not allowed';

  else

    -- Se conserva exactamente la capacidad administrativa existente.
    if v_next not in (
      'received', 'preparing', 'ready',
      'packed', 'dispatched', 'completed', 'cancelled'
    ) then
      raise exception 'Station transition is not allowed';
    end if;

    update public.customer_orders
    set
      station_status = v_next,
      status =
        case
          when v_next = 'dispatched' then 'sent'
          when v_next = 'completed' then 'delivered'
          when v_next = 'cancelled' then 'cancelled'
          else status
        end,
      updated_at = now()
    where id = p_order_id
      and user_id = p_restaurant_user_id;

  end if;

  return query
  select
    co.id,
    co.status,
    case
      when v_station in (
        'kitchen', 'grill', 'drinks',
        'fast_food', 'starters', 'salads', 'packing'
      )
      then (
        select t.status
        from public.order_station_tasks t
        where t.customer_order_id = co.id
          and t.restaurant_user_id = p_restaurant_user_id
          and t.station = v_station
      )
      else co.station_status
    end,
    co.updated_at
  from public.customer_orders co
  where co.id = p_order_id
    and co.user_id = p_restaurant_user_id;
end;
$function$;

-- Endurecer las dos lecturas (full + delta Realtime) sin duplicar la funcion completa.
do $patch_reads$
declare
  v_signature text;
  v_proc regprocedure;
  v_def text;
  v_old_task text := E'and co.status in (''accepted'', ''sent'')\n      and co.created_at >= now() - interval ''36 hours''';
  v_new_task text := E'and co.status in (''accepted'', ''sent'')\n      and (v_station <> ''packing'' or co.station_status = ''ready'')\n      and co.created_at >= now() - interval ''36 hours''';
  v_old_dispatch text := E'and co.station_status not in (''completed'', ''cancelled'')\n    and co.created_at >= now() - interval ''36 hours''';
  v_new_dispatch text := E'and co.station_status not in (''completed'', ''cancelled'')\n    and (\n      v_station <> ''dispatch''\n      or co.station_status in (''packed'', ''dispatched'')\n      or (\n        co.station_status = ''ready''\n        and not exists (\n          select 1\n          from public.order_station_tasks packing_task\n          where packing_task.customer_order_id = co.id\n            and packing_task.restaurant_user_id = p_restaurant_user_id\n            and packing_task.station = ''packing''\n            and packing_task.status <> ''cancelled''\n        )\n      )\n    )\n    and co.created_at >= now() - interval ''36 hours''';
begin
  foreach v_signature in array array[
    'public.list_my_station_orders(uuid,text)',
    'public.list_my_station_orders(uuid,text,uuid[])'
  ] loop
    v_proc := to_regprocedure(v_signature);
    select replace(pg_get_functiondef(v_proc), E'\r\n', E'\n') into v_def;

    if position(v_new_task in v_def) = 0 then
      if position(v_old_task in v_def) = 0 then
        raise exception 'V91-28: no se encontro el contrato de Empaque en %.', v_signature;
      end if;
      v_def := replace(v_def, v_old_task, v_new_task);
    end if;

    if position(v_new_dispatch in v_def) = 0 then
      if position(v_old_dispatch in v_def) = 0 then
        raise exception 'V91-28: no se encontro el contrato de Despacho en %.', v_signature;
      end if;
      v_def := replace(v_def, v_old_dispatch, v_new_dispatch);
    end if;

    execute v_def;
  end loop;
end;
$patch_reads$;

revoke all on function public.update_my_station_order(uuid,uuid,text,text) from public, anon;
grant execute on function public.update_my_station_order(uuid,uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;

-- VERIFICACION MANUAL POSTERIOR
-- Debe devolver: dispatch_requires_packed_or_legacy = true
-- y las dos filas de lectura con packing_guard=true / dispatch_guard=true.
select
  position('co_dispatch.station_status = ''packed''' in pg_get_functiondef(
    'public.update_my_station_order(uuid,uuid,text,text)'::regprocedure
  )) > 0
  and position('packing_task.status <> ''cancelled''' in pg_get_functiondef(
    'public.update_my_station_order(uuid,uuid,text,text)'::regprocedure
  )) > 0 as dispatch_requires_packed_or_legacy;

select
  p.oid::regprocedure::text as function_name,
  position('(v_station <> ''packing'' or co.station_status = ''ready'')' in pg_get_functiondef(p.oid)) > 0 as packing_guard,
  position('v_station <> ''dispatch''' in pg_get_functiondef(p.oid)) > 0 as dispatch_guard
from pg_proc p
where p.oid in (
  'public.list_my_station_orders(uuid,text)'::regprocedure,
  'public.list_my_station_orders(uuid,text,uuid[])'::regprocedure
)
order by 1;
