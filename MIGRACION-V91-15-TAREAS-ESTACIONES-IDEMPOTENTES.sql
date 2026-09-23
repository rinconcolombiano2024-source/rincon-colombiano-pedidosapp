-- Sucesora de V91-06: no ejecuta backfill ni modifica migraciones historicas.
-- Conserva agrupacion, permisos y estados de pedidos ya despachados.
begin;
create or replace function public.rc_ordera_sync_order_station_tasks(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.customer_orders%rowtype;
  v_item jsonb;
  v_station text;
  v_groups jsonb := '{}'::jsonb;
  v_group record;
  v_existing boolean;
  v_editable boolean;
  v_pending boolean;
begin
  select co.* into v_order from public.customer_orders co
  where co.id = p_order_id for update;
  if not found then return; end if;

  if v_order.status in ('cancelled', 'rejected') then
    update public.order_station_tasks
    set status = 'cancelled', completed_at = coalesce(completed_at, now()), updated_at = now()
    where customer_order_id = v_order.id and status <> 'cancelled';
    return;
  end if;

  v_editable := v_order.status in ('pending', 'accepted', 'sent')
    and coalesce(v_order.station_status, 'received') not in ('dispatched', 'completed');
  select exists(select 1 from public.order_station_tasks t
    where t.customer_order_id = v_order.id) into v_existing;

  for v_item in select value from jsonb_array_elements(coalesce(v_order.order_json->'items', '[]'::jsonb))
  loop
    v_station := public.rc_ordera_order_item_station(v_order.user_id, v_item);
    v_groups := jsonb_set(v_groups, array[v_station],
      coalesce(v_groups->v_station, '[]'::jsonb)
      || jsonb_build_array(v_item || jsonb_build_object('station', v_station)), true);
  end loop;

  if v_editable then
    update public.order_station_tasks t
    set status = 'cancelled', completed_at = coalesce(t.completed_at, now()), updated_at = now()
    where t.customer_order_id = v_order.id and t.restaurant_user_id = v_order.user_id
      and t.status <> 'cancelled'
      and ((t.station <> 'packing' and not (v_groups ? t.station))
        or v_groups = '{}'::jsonb);
  end if;

  for v_group in select key, value from jsonb_each(v_groups)
  loop
    insert into public.order_station_tasks as task
      (customer_order_id, restaurant_user_id, station, status, items, updated_at)
    values (v_order.id, v_order.user_id, v_group.key,
      case when v_editable and v_existing then 'received'
        when v_order.station_status in ('ready', 'packed', 'dispatched', 'completed') then 'ready'
        else 'received' end, v_group.value, now())
    on conflict (customer_order_id, station) do update
    set items = excluded.items,
      status = case when v_editable and task.status in ('ready', 'cancelled') then 'received' else task.status end,
      started_at = case when v_editable and task.status in ('ready', 'cancelled') then null else task.started_at end,
      completed_at = case when v_editable and task.status in ('ready', 'cancelled') then null else task.completed_at end,
      updated_at = now()
    where task.items is distinct from excluded.items
      or (v_editable and task.status = 'cancelled');
  end loop;

  if v_groups <> '{}'::jsonb then
    select exists(select 1 from public.order_station_tasks t
      where t.customer_order_id = v_order.id and t.restaurant_user_id = v_order.user_id
        and t.station <> 'packing' and t.status not in ('ready', 'cancelled')) into v_pending;
    insert into public.order_station_tasks as task
      (customer_order_id, restaurant_user_id, station, status, items, updated_at)
    values (v_order.id, v_order.user_id, 'packing',
      case when v_editable and v_pending then 'blocked'
        when v_order.station_status in ('ready', 'packed', 'dispatched', 'completed') then 'received'
        else 'blocked' end,
      coalesce(v_order.order_json->'items', '[]'::jsonb), now())
    on conflict (customer_order_id, station) do update
    set items = excluded.items,
      status = case when v_editable then case when v_pending then 'blocked' else 'received' end else task.status end,
      started_at = case when v_editable then null else task.started_at end,
      completed_at = case when v_editable then null else task.completed_at end,
      updated_at = now()
    where task.items is distinct from excluded.items
      or (v_editable and (task.status = 'cancelled' or (v_pending and task.status <> 'blocked')));

    -- Solo station_status: no dispara el trigger de order_json/status ni cambia el pedido comercial.
    if v_editable and v_pending then
      update public.customer_orders co set station_status = 'preparing', updated_at = now()
      where co.id = v_order.id and co.user_id = v_order.user_id
        and co.station_status in ('ready', 'packed');
    end if;
  end if;
end;
$$;
commit;
