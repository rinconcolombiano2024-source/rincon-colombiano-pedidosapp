-- RC ORDERA V91.03
-- Completa el contrato multiestacion usado por mesero.js y garantiza Realtime
-- para customer_orders. Incremental, idempotente y sin cambios destructivos.

begin;

do $preflight$
begin
  if to_regclass('public.restaurant_staff_memberships') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.customer_orders') is null
     or to_regclass('public.order_station_tasks') is null then
    raise exception 'Falta la estructura de personal, pedidos o estaciones de RC ORDERA.';
  end if;
end;
$preflight$;

create or replace function public.get_my_restaurant_stations(p_restaurant_user_id uuid)
returns table (
  restaurant_user_id uuid,
  member_user_id uuid,
  station text,
  active boolean,
  display_name text,
  permissions jsonb,
  business_name text,
  logo_url text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    m.restaurant_user_id,
    m.member_user_id,
    m.station,
    m.active,
    m.display_name,
    coalesce(m.permissions, '{}'::jsonb),
    coalesce(nullif(rp.business_name, ''), 'Restaurante')::text,
    coalesce(rp.logo_url, '')::text
  from public.restaurant_staff_memberships m
  join public.restaurant_profiles rp
    on rp.user_id = m.restaurant_user_id
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = auth.uid()
    and m.active = true
    and rp.active = true
    and rp.deleted_at is null
  order by
    case m.station
      when 'manager' then 1
      when 'cashier' then 2
      when 'waiter' then 3
      when 'kitchen' then 4
      when 'grill' then 5
      when 'drinks' then 6
      when 'fast_food' then 7
      when 'starters' then 8
      when 'salads' then 9
      when 'packing' then 10
      when 'dispatch' then 11
      else 12
    end,
    m.updated_at desc;
$$;

create or replace function public.submit_waiter_order(
  p_id uuid,
  p_restaurant_user_id uuid,
  p_table_label text,
  p_customer_name text,
  p_order_type text,
  p_payment_method text,
  p_notes text,
  p_items jsonb
)
returns table (id uuid, total numeric, created_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member_id uuid := auth.uid();
  v_membership public.restaurant_staff_memberships%rowtype;
  v_menu jsonb;
  v_item jsonb;
  v_product jsonb;
  v_category record;
  v_candidate jsonb;
  v_product_id text;
  v_product_name text;
  v_station text;
  v_quantity integer;
  v_price numeric(12,2);
  v_total numeric(12,2) := 0;
  v_is_custom boolean;
  v_validated_items jsonb := '[]'::jsonb;
  v_order_json jsonb;
  v_order_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if v_member_id is null then raise exception 'Not authenticated'; end if;

  select m.*
  into v_membership
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = v_member_id
    and m.station in ('waiter', 'cashier', 'manager')
    and m.active = true
    and coalesce((m.permissions->>'create_orders')::boolean, false) = true
  order by case m.station when 'manager' then 1 when 'cashier' then 2 else 3 end
  limit 1;
  if not found then raise exception 'Waiter is not authorized for this restaurant'; end if;

  if not exists (
    select 1
    from public.restaurant_profiles rp
    where rp.user_id = p_restaurant_user_id
      and rp.active = true
      and rp.deleted_at is null
  ) then
    raise exception 'Restaurant is not active';
  end if;

  select coalesce(s.menu, '{}'::jsonb)
  into v_menu
  from public.app_settings s
  where s.user_id = p_restaurant_user_id;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Order has no items';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product := null;
    v_product_id := trim(coalesce(v_item->>'productId', v_item->>'product_id', ''));
    v_is_custom := lower(trim(coalesce(v_item->>'custom', 'false'))) = 'true';
    v_quantity := greatest(
      1,
      least(
        99,
        case
          when coalesce(v_item->>'qty', v_item->>'quantity', '') ~ '^[0-9]+$'
            then coalesce(v_item->>'qty', v_item->>'quantity')::integer
          else 1
        end
      )
    );

    if v_is_custom then
      v_product_name := upper(left(trim(coalesce(v_item->>'name', '')), 160));
      if v_product_name = '' then raise exception 'Custom product name is required'; end if;
      if coalesce(v_item->>'price', '') !~ '^[0-9]+([.][0-9]{1,2})?$' then
        raise exception 'Custom product price is invalid';
      end if;
      v_price := round((v_item->>'price')::numeric, 2);
      if v_price <= 0 or v_price > 1000000 then raise exception 'Custom product price is invalid'; end if;
      v_station := lower(trim(coalesce(v_item->>'station', 'kitchen')));
      if v_station not in ('kitchen', 'grill', 'drinks', 'fast_food', 'starters', 'salads') then
        v_station := 'kitchen';
      end if;
    else
      for v_category in select key, value from jsonb_each(coalesce(v_menu, '{}'::jsonb))
      loop
        if jsonb_typeof(v_category.value) = 'array' then
          select product.value
          into v_candidate
          from jsonb_array_elements(v_category.value) as product(value)
          where (
            v_product_id <> ''
            and trim(coalesce(product.value->>'id', product.value->>'productId', '')) = v_product_id
          ) or (
            v_product_id = ''
            and lower(trim(product.value->>'name')) = lower(trim(v_item->>'name'))
          )
          limit 1;
          if v_candidate is not null then
            v_product := v_candidate;
            exit;
          end if;
        end if;
      end loop;
      if v_product is null then raise exception 'Menu product was not found'; end if;
      if coalesce((v_product->>'available')::boolean, true) = false then
        raise exception 'Menu product is unavailable';
      end if;
      v_product_id := coalesce(nullif(trim(v_product->>'id'), ''), v_product_id);
      v_product_name := left(coalesce(v_product->>'name', ''), 160);
      v_price := greatest(0, round(coalesce((v_product->>'price')::numeric, 0), 2));
      v_station := lower(trim(coalesce(
        v_product->>'station',
        v_product->>'preparationStation',
        v_product->>'preparation_station',
        'kitchen'
      )));
      if v_station not in ('kitchen', 'grill', 'drinks', 'fast_food', 'starters', 'salads') then
        v_station := 'kitchen';
      end if;
    end if;

    v_total := v_total + (v_price * v_quantity);
    v_validated_items := v_validated_items || jsonb_build_array(
      jsonb_build_object(
        'productId', v_product_id,
        'product_id', v_product_id,
        'name', v_product_name,
        'product_name_snapshot', v_product_name,
        'price', v_price,
        'unit_price_snapshot', v_price,
        'qty', v_quantity,
        'quantity', v_quantity,
        'total_snapshot', v_price * v_quantity,
        'note', upper(left(trim(coalesce(v_item->>'note', '')), 500)),
        'station', v_station,
        'custom', v_is_custom
      )
    );
  end loop;

  v_order_json := jsonb_build_object(
    'source', 'waiter',
    'serverName', v_membership.display_name,
    'type', coalesce(nullif(trim(p_order_type), ''), 'Comer en el punto'),
    'paymentMethod', coalesce(nullif(trim(p_payment_method), ''), 'Pago en caja'),
    'notes', upper(left(trim(coalesce(p_notes, '')), 1000)),
    'items', v_validated_items
  );

  insert into public.customer_orders (
    id, user_id, customer_user_id, status, table_label, customer_name,
    order_type, order_json, total, source, created_by_user_id, server_name,
    created_at, updated_at
  ) values (
    v_order_id, p_restaurant_user_id, null, 'pending',
    left(trim(coalesce(p_table_label, '')), 120),
    left(trim(coalesce(p_customer_name, '')), 120),
    coalesce(nullif(trim(p_order_type), ''), 'Comer en el punto'),
    v_order_json, v_total, 'waiter', v_member_id, v_membership.display_name,
    now(), now()
  )
  on conflict on constraint customer_orders_pkey do nothing;

  return query
  select co.id, co.total, co.created_at
  from public.customer_orders co
  where co.id = v_order_id
    and co.created_by_user_id = v_member_id
    and co.user_id = p_restaurant_user_id;
end;
$$;

create or replace function public.list_my_station_orders(
  p_restaurant_user_id uuid,
  p_station text
)
returns table (
  order_id uuid,
  order_status text,
  station_status text,
  table_label text,
  customer_name text,
  order_type text,
  items jsonb,
  notes text,
  source text,
  server_name text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member_id uuid := auth.uid();
  v_station text := lower(trim(coalesce(p_station, '')));
begin
  if v_member_id is null then raise exception 'Not authenticated'; end if;
  if v_station not in (
    'waiter', 'cashier', 'manager', 'kitchen', 'grill', 'drinks',
    'fast_food', 'starters', 'salads', 'packing', 'dispatch'
  ) then
    raise exception 'Station is invalid';
  end if;
  if not exists (
    select 1
    from public.restaurant_staff_memberships m
    join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
    where m.restaurant_user_id = p_restaurant_user_id
      and m.member_user_id = v_member_id
      and m.station = v_station
      and m.active = true
      and rp.active = true
      and rp.deleted_at is null
  ) then
    raise exception 'Station is not authorized';
  end if;

  if v_station in ('kitchen', 'grill', 'drinks', 'fast_food', 'starters', 'salads', 'packing') then
    return query
    select
      co.id,
      co.status,
      task.status,
      co.table_label,
      co.customer_name,
      co.order_type,
      task.items,
      upper(left(coalesce(co.order_json->>'notes', ''), 1000)),
      co.source,
      co.server_name,
      co.created_at,
      greatest(co.updated_at, task.updated_at)
    from public.order_station_tasks task
    join public.customer_orders co on co.id = task.customer_order_id
    where task.restaurant_user_id = p_restaurant_user_id
      and task.station = v_station
      and task.status not in ('blocked', 'packed', 'cancelled')
      and co.status in ('accepted', 'sent')
      and co.created_at >= now() - interval '36 hours'
    order by co.created_at asc
    limit 100;
    return;
  end if;

  return query
  select
    co.id,
    co.status,
    co.station_status,
    co.table_label,
    co.customer_name,
    co.order_type,
    coalesce(co.order_json->'items', '[]'::jsonb),
    upper(left(coalesce(co.order_json->>'notes', ''), 1000)),
    co.source,
    co.server_name,
    co.created_at,
    co.updated_at
  from public.customer_orders co
  where co.user_id = p_restaurant_user_id
    and co.status in ('accepted', 'sent')
    and co.station_status not in ('completed', 'cancelled')
    and co.created_at >= now() - interval '36 hours'
  order by co.created_at asc
  limit 100;
end;
$$;

create or replace function public.update_my_station_order(
  p_restaurant_user_id uuid,
  p_order_id uuid,
  p_next_station_status text,
  p_station text
)
returns table (
  order_id uuid,
  order_status text,
  station_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member_id uuid := auth.uid();
  v_station text := lower(trim(coalesce(p_station, '')));
  v_next text := lower(trim(coalesce(p_next_station_status, '')));
  v_current text;
  v_order_status text;
begin
  if v_member_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1
    from public.restaurant_staff_memberships m
    join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
    where m.restaurant_user_id = p_restaurant_user_id
      and m.member_user_id = v_member_id
      and m.station = v_station
      and m.active = true
      and rp.active = true
      and rp.deleted_at is null
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

  if v_station in ('kitchen', 'grill', 'drinks', 'fast_food', 'starters', 'salads', 'packing') then
    select task.status
    into v_current
    from public.order_station_tasks task
    where task.customer_order_id = p_order_id
      and task.restaurant_user_id = p_restaurant_user_id
      and task.station = v_station
    for update;
    if not found then raise exception 'Station task was not found'; end if;

    if v_station = 'packing' then
      if v_next <> 'packed' or v_current <> 'received' then
        raise exception 'Station transition is not allowed';
      end if;
      update public.order_station_tasks
      set status = 'packed', completed_at = now(), updated_at = now()
      where customer_order_id = p_order_id
        and restaurant_user_id = p_restaurant_user_id
        and station = 'packing';
      update public.customer_orders
      set station_status = 'packed', updated_at = now()
      where id = p_order_id and user_id = p_restaurant_user_id;
    else
      if not (
        (v_current = 'received' and v_next = 'preparing')
        or (v_current = 'preparing' and v_next = 'ready')
      ) then
        raise exception 'Station transition is not allowed';
      end if;
      update public.order_station_tasks
      set
        status = v_next,
        started_at = case when v_next = 'preparing' then coalesce(started_at, now()) else started_at end,
        completed_at = case when v_next = 'ready' then now() else completed_at end,
        updated_at = now()
      where customer_order_id = p_order_id
        and restaurant_user_id = p_restaurant_user_id
        and station = v_station;

      if not exists (
        select 1
        from public.order_station_tasks task
        where task.customer_order_id = p_order_id
          and task.restaurant_user_id = p_restaurant_user_id
          and task.station <> 'packing'
          and task.status not in ('ready', 'cancelled')
      ) then
        update public.order_station_tasks
        set status = 'received', updated_at = now()
        where customer_order_id = p_order_id
          and restaurant_user_id = p_restaurant_user_id
          and station = 'packing'
          and status = 'blocked';
        update public.customer_orders
        set station_status = 'ready', updated_at = now()
        where id = p_order_id and user_id = p_restaurant_user_id;
      else
        update public.customer_orders
        set station_status = 'preparing', updated_at = now()
        where id = p_order_id and user_id = p_restaurant_user_id;
      end if;
    end if;
  elsif v_station = 'dispatch' then
    if v_next = 'dispatched' then
      update public.customer_orders
      set station_status = 'dispatched', status = 'sent', updated_at = now()
      where id = p_order_id
        and user_id = p_restaurant_user_id
        and station_status in ('ready', 'packed');
    elsif v_next = 'completed' then
      update public.customer_orders
      set station_status = 'completed', status = 'delivered', updated_at = now()
      where id = p_order_id
        and user_id = p_restaurant_user_id
        and station_status = 'dispatched';
    else
      raise exception 'Station transition is not allowed';
    end if;
    if not found then raise exception 'Station transition is not allowed'; end if;
  elsif v_station in ('manager', 'cashier') then
    if v_next not in ('received', 'preparing', 'ready', 'packed', 'dispatched', 'completed', 'cancelled') then
      raise exception 'Station transition is not allowed';
    end if;
    update public.customer_orders
    set
      station_status = v_next,
      status = case
        when v_next = 'dispatched' then 'sent'
        when v_next = 'completed' then 'delivered'
        when v_next = 'cancelled' then 'cancelled'
        else status
      end,
      updated_at = now()
    where id = p_order_id and user_id = p_restaurant_user_id;
  else
    raise exception 'Station transition is not allowed';
  end if;

  return query
  select
    co.id,
    co.status,
    case
      when v_station in ('kitchen', 'grill', 'drinks', 'fast_food', 'starters', 'salads', 'packing')
        then (
          select task.status
          from public.order_station_tasks task
          where task.customer_order_id = co.id and task.station = v_station
        )
      else co.station_status
    end,
    co.updated_at
  from public.customer_orders co
  where co.id = p_order_id and co.user_id = p_restaurant_user_id;
end;
$$;

revoke all on function public.get_my_restaurant_stations(uuid) from public, anon;
revoke all on function public.submit_waiter_order(uuid, uuid, text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.list_my_station_orders(uuid, text) from public, anon;
revoke all on function public.update_my_station_order(uuid, uuid, text, text) from public, anon;
grant execute on function public.get_my_restaurant_stations(uuid) to authenticated;
grant execute on function public.submit_waiter_order(uuid, uuid, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.list_my_station_orders(uuid, text) to authenticated;
grant execute on function public.update_my_station_order(uuid, uuid, text, text) to authenticated;

alter table public.customer_orders replica identity full;

do $publication$
begin
  if exists (
    select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_orders'
  ) then
    alter publication supabase_realtime add table public.customer_orders;
  end if;
end;
$publication$;

notify pgrst, 'reload schema';

commit;
