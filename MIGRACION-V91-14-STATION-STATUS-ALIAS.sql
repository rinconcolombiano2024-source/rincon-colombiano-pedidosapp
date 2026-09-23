BEGIN;

CREATE OR REPLACE FUNCTION public.update_my_station_order(
  p_restaurant_user_id uuid,
  p_order_id uuid,
  p_next_station_status text,
  p_station text
)
RETURNS TABLE(
  order_id uuid,
  order_status text,
  station_status text,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_member_id uuid := auth.uid();
  v_station text := lower(trim(coalesce(p_station, '')));
  v_next text := lower(trim(coalesce(p_next_station_status, '')));
  v_current text;
  v_order_status text;
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

  select co.status
  into v_order_status
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
      and task.station = v_station
    for update;

    if not found then
      raise exception 'Station task was not found';
    end if;

    if v_station = 'packing' then

      if v_next <> 'packed' or v_current <> 'received' then
        raise exception 'Station transition is not allowed';
      end if;

      update public.order_station_tasks
      set
        status = 'packed',
        completed_at = now(),
        updated_at = now()
      where customer_order_id = p_order_id
        and station = 'packing';

      update public.customer_orders
      set
        station_status = 'packed',
        updated_at = now()
      where id = p_order_id;

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
        and station = v_station;

      if not exists (
        select 1
        from public.order_station_tasks t
        where t.customer_order_id = p_order_id
          and t.station <> 'packing'
          and t.status not in ('ready', 'cancelled')
      ) then

        update public.order_station_tasks
        set
          status = 'received',
          updated_at = now()
        where customer_order_id = p_order_id
          and station = 'packing'
          and status = 'blocked';

        update public.customer_orders
        set
          station_status = 'ready',
          updated_at = now()
        where id = p_order_id;

      else

        update public.customer_orders
        set
          station_status = 'preparing',
          updated_at = now()
        where id = p_order_id;

      end if;
    end if;

  elsif v_station = 'dispatch' then

    if v_next = 'dispatched' then

      update public.customer_orders as co_dispatch
      set
        station_status = 'dispatched',
        status = 'sent',
        updated_at = now()
      where co_dispatch.id = p_order_id
        and co_dispatch.station_status in ('ready', 'packed');

    elsif v_next = 'completed' then

      update public.customer_orders as co_dispatch
      set
        station_status = 'completed',
        status = 'delivered',
        updated_at = now()
      where co_dispatch.id = p_order_id
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
    where id = p_order_id;

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
          and t.station = v_station
      )
      else co.station_status
    end,
    co.updated_at
  from public.customer_orders co
  where co.id = p_order_id;
end;
$function$;

COMMIT;
