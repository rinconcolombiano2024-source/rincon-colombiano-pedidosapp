-- RC ORDERA V86.01
-- Integridad de tickets, fecha operativa y aceptacion atomica de pedidos.
-- Migracion incremental e idempotente. No elimina pedidos ni tickets existentes.

begin;

do $preflight$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.customer_orders') is null
     or to_regclass('public.ticket_counters') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.restaurant_staff_memberships') is null then
    raise exception 'Falta la estructura base de RC ORDERA. Ejecuta primero las migraciones hasta V85.';
  end if;

  if to_regprocedure('public.rc_ordera_sync_order_station_tasks(uuid)') is null
     or to_regprocedure('public.rc_ordera_jsonb_numeric(jsonb,numeric)') is null then
    raise exception 'Faltan funciones de V82/V85. Ejecuta las migraciones anteriores antes de V86.01.';
  end if;
end;
$preflight$;

-- Esta tabla protege los numeros nuevos sin imponer una restriccion destructiva
-- sobre posibles duplicados historicos. El backfill conserva un representante
-- por numero y fecha; no modifica ningun pedido existente.
create table if not exists public.order_ticket_reservations (
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  business_date date not null,
  ticket_number integer not null check (ticket_number > 0),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (restaurant_user_id, business_date, ticket_number)
);

alter table public.order_ticket_reservations enable row level security;
revoke all on table public.order_ticket_reservations from anon, authenticated;

insert into public.order_ticket_reservations (
  restaurant_user_id, business_date, ticket_number, order_id, created_at
)
select distinct on (o.user_id, o.business_date, o.ticket_number)
  o.user_id,
  o.business_date,
  o.ticket_number,
  o.id,
  o.created_at
from public.orders o
where o.ticket_number > 0
order by o.user_id, o.business_date, o.ticket_number, o.created_at, o.id
on conflict do nothing;

create or replace function public.rc_ordera_reserve_order_ticket()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.order_ticket_reservations r
    where r.order_id = old.id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.order_ticket_reservations (
      restaurant_user_id, business_date, ticket_number, order_id
    ) values (
      new.user_id, new.business_date, new.ticket_number, new.id
    )
    on conflict (restaurant_user_id, business_date, ticket_number) do update
    set order_id = excluded.order_id
    where order_ticket_reservations.order_id = excluded.order_id;

    if not found then
      raise exception 'Ticket % is already assigned for business date %',
        new.ticket_number, new.business_date
        using errcode = '23505';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists rc_ordera_reserve_order_ticket_insert on public.orders;
create trigger rc_ordera_reserve_order_ticket_insert
after insert on public.orders
for each row execute function public.rc_ordera_reserve_order_ticket();

drop trigger if exists rc_ordera_reserve_order_ticket_update on public.orders;
create trigger rc_ordera_reserve_order_ticket_update
after update of user_id, business_date, ticket_number on public.orders
for each row execute function public.rc_ordera_reserve_order_ticket();

drop trigger if exists rc_ordera_reserve_order_ticket_delete on public.orders;
create trigger rc_ordera_reserve_order_ticket_delete
after delete on public.orders
for each row execute function public.rc_ordera_reserve_order_ticket();

create or replace function public.rc_ordera_restaurant_timezone(p_restaurant_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_timezone text;
begin
  select coalesce(
    nullif(trim(rp.timezone), ''),
    case upper(trim(coalesce(rp.country_code, '')))
      when 'PL' then 'Europe/Warsaw'
      when 'CO' then 'America/Bogota'
      else 'UTC'
    end
  )
  into v_timezone
  from public.restaurant_profiles rp
  where rp.user_id = p_restaurant_user_id
    and rp.deleted_at is null;

  if v_timezone is null then
    raise exception 'Restaurant was not found';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = v_timezone) then
    return 'UTC';
  end if;

  return v_timezone;
end;
$$;

create or replace function public.get_restaurant_business_context(p_restaurant_user_id uuid)
returns table (
  business_date date,
  timezone_name text,
  day_start timestamptz,
  day_end timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_timezone text;
  v_business_date date;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if v_actor <> p_restaurant_user_id
     and not exists (
       select 1
       from public.restaurant_staff_memberships m
       where m.restaurant_user_id = p_restaurant_user_id
         and m.member_user_id = v_actor
         and m.active = true
     ) then
    raise exception 'Not authorized';
  end if;

  v_timezone := public.rc_ordera_restaurant_timezone(p_restaurant_user_id);
  v_business_date := (now() at time zone v_timezone)::date;

  return query select
    v_business_date,
    v_timezone,
    v_business_date::timestamp at time zone v_timezone,
    (v_business_date + 1)::timestamp at time zone v_timezone;
end;
$$;

create or replace function public.get_current_restaurant_business_context()
returns table (
  business_date date,
  timezone_name text,
  day_start timestamptz,
  day_end timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select * from public.get_restaurant_business_context(auth.uid());
$$;

create or replace function public.claim_next_ticket(p_business_date date)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_business_date is null then
    raise exception 'Business date is required';
  end if;

  insert into public.ticket_counters (user_id, business_date, next_ticket)
  values (v_user_id, p_business_date, 1)
  on conflict (user_id, business_date) do nothing;

  select tc.next_ticket
  into v_ticket
  from public.ticket_counters tc
  where tc.user_id = v_user_id
    and tc.business_date = p_business_date
  for update;

  v_ticket := greatest(coalesce(v_ticket, 1), 1);
  while exists (
    select 1
    from public.order_ticket_reservations r
    where r.restaurant_user_id = v_user_id
      and r.business_date = p_business_date
      and r.ticket_number = v_ticket
  ) loop
    v_ticket := v_ticket + 1;
  end loop;

  update public.ticket_counters tc
  set next_ticket = v_ticket + 1,
      updated_at = now()
  where tc.user_id = v_user_id
    and tc.business_date = p_business_date;

  return v_ticket;
end;
$$;

create or replace function public.set_next_ticket(p_business_date date, p_next_ticket integer)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_business_date is null or p_next_ticket < 1 then
    raise exception 'Ticket and business date are invalid';
  end if;

  insert into public.ticket_counters (user_id, business_date, next_ticket)
  values (v_user_id, p_business_date, p_next_ticket)
  on conflict (user_id, business_date) do update
  set next_ticket = greatest(ticket_counters.next_ticket, excluded.next_ticket),
      updated_at = now();
end;
$$;

create or replace function public.accept_customer_order_atomic(
  p_customer_order_id uuid,
  p_restaurant_order_id uuid,
  p_server_name text default ''
)
returns table (
  customer_order_id uuid,
  restaurant_order_id uuid,
  ticket_number integer,
  business_date date,
  accepted_order_json jsonb,
  order_total numeric,
  already_accepted boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_customer public.customer_orders%rowtype;
  v_existing public.orders%rowtype;
  v_business_context record;
  v_ticket integer;
  v_now timestamptz := now();
  v_source_item jsonb;
  v_source_items jsonb := '[]'::jsonb;
  v_order_items jsonb := '[]'::jsonb;
  v_station text;
  v_name text;
  v_note text;
  v_product_id text;
  v_quantity integer;
  v_price numeric;
  v_customer_label text;
  v_source_note text;
  v_notes text;
  v_server_name text;
  v_payment_method text;
  v_order_json jsonb;
begin
  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_customer_order_id is null or p_restaurant_order_id is null then
    raise exception 'Order identifiers are required';
  end if;

  select co.*
  into v_customer
  from public.customer_orders co
  where co.id = p_customer_order_id
    and co.user_id = v_owner_id
  for update;

  if not found then
    raise exception 'Customer order was not found';
  end if;

  if v_customer.status = 'accepted' and v_customer.restaurant_order_id is not null then
    select o.* into v_existing
    from public.orders o
    where o.id = v_customer.restaurant_order_id
      and o.user_id = v_owner_id;

    if not found then
      raise exception 'Accepted order is missing its restaurant ticket';
    end if;

    return query select
      v_customer.id,
      v_existing.id,
      v_existing.ticket_number,
      v_existing.business_date,
      v_existing.order_json,
      v_existing.total,
      true;
    return;
  end if;

  if v_customer.status <> 'pending' then
    raise exception 'Only pending orders can be accepted';
  end if;

  v_payment_method := lower(trim(coalesce(
    nullif(v_customer.payment_method, ''),
    v_customer.order_json->>'paymentMethod',
    ''
  )));

  if v_payment_method in ('online', 'pago en linea', 'online payment')
     and lower(trim(coalesce(v_customer.payment_status, 'pending'))) <> 'paid' then
    raise exception 'Online payment is not confirmed';
  end if;

  select * into v_business_context
  from public.get_current_restaurant_business_context();
  v_ticket := public.claim_next_ticket(v_business_context.business_date);

  for v_source_item in
    select value
    from jsonb_array_elements(coalesce(v_customer.order_json->'items', '[]'::jsonb))
  loop
    v_name := left(trim(coalesce(
      v_source_item->>'product_name_snapshot',
      v_source_item->>'name',
      ''
    )), 240);
    if v_name = '' then
      continue;
    end if;

    v_product_id := left(trim(coalesce(
      v_source_item->>'product_id',
      v_source_item->>'productId',
      ''
    )), 160);
    v_quantity := least(greatest(
      floor(public.rc_ordera_jsonb_numeric(coalesce(
        v_source_item->'quantity',
        v_source_item->'qty',
        '1'::jsonb
      ), 1))::integer,
      1
    ), 100);
    v_price := greatest(public.rc_ordera_jsonb_numeric(coalesce(
      v_source_item->'unit_price_snapshot',
      v_source_item->'price',
      '0'::jsonb
    ), 0), 0);
    v_note := upper(left(trim(coalesce(
      v_source_item->>'note',
      v_source_item #>> '{options_snapshot,note}',
      ''
    )), 1000));
    v_station := public.rc_ordera_order_item_station(v_owner_id, v_source_item);

    v_source_items := v_source_items || jsonb_build_array(
      v_source_item || jsonb_build_object('station', v_station)
    );
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'productId', v_product_id,
      'name', v_name,
      'price', v_price,
      'qty', v_quantity,
      'note', v_note,
      'station', v_station
    ));
  end loop;

  if jsonb_array_length(v_order_items) = 0 then
    raise exception 'Order has no valid products';
  end if;

  v_customer_label := left(trim(concat_ws(' - ',
    nullif(trim(v_customer.table_label), ''),
    nullif(trim(v_customer.customer_name), '')
  )), 240);
  if v_customer_label = '' then
    v_customer_label := case when v_customer.source = 'waiter' then 'Pedido de mesero' else 'Cliente QR' end;
  end if;

  v_source_note := upper(
    case when v_customer.source = 'waiter' then 'PEDIDO MESERO ' else 'PEDIDO CLIENTE QR ' end
    || upper(left(v_customer.id::text, 8))
  );
  v_notes := upper(left(trim(concat_ws(' | ',
    nullif(trim(v_customer.order_json->>'notes'), ''),
    v_source_note
  )), 2000));
  v_server_name := left(trim(coalesce(
    nullif(p_server_name, ''),
    nullif(v_customer.server_name, ''),
    nullif(v_customer.order_json->>'serverName', ''),
    'Caja'
  )), 100);

  v_order_json := jsonb_build_object(
    'id', p_restaurant_order_id,
    'ticketNumber', v_ticket,
    'businessDate', v_business_context.business_date,
    'type', coalesce(nullif(v_customer.order_type, ''), v_customer.order_json->>'type', 'Comer en el punto'),
    'paymentMethod', coalesce(nullif(v_customer.payment_method, ''), v_customer.order_json->>'paymentMethod', 'Pago en caja'),
    'paymentStatus', coalesce(nullif(v_customer.payment_status, ''), 'pending'),
    'customer', v_customer_label,
    'server', v_server_name,
    'cashier', v_server_name,
    'notes', v_notes,
    'delivery', coalesce(v_customer.order_json->'delivery', 'null'::jsonb),
    'customerOrderId', v_customer.id,
    'items', v_order_items,
    'createdAt', v_now,
    'updatedAt', v_now,
    'saved', true,
    'syncStatus', 'synced'
  );

  insert into public.orders (
    id, user_id, ticket_number, business_date, order_json, total, created_at, updated_at
  ) values (
    p_restaurant_order_id, v_owner_id, v_ticket, v_business_context.business_date,
    v_order_json, v_customer.total, v_now, v_now
  );

  update public.customer_orders co
  set status = 'accepted',
      station_status = 'received',
      restaurant_order_id = p_restaurant_order_id,
      server_name = v_server_name,
      order_json = co.order_json || jsonb_build_object(
        'items', v_source_items,
        'serverName', v_server_name,
        'restaurantOrderId', p_restaurant_order_id,
        'ticketNumber', v_ticket
      ),
      updated_at = v_now
  where co.id = v_customer.id;

  perform public.rc_ordera_sync_order_station_tasks(v_customer.id);

  return query select
    v_customer.id,
    p_restaurant_order_id,
    v_ticket,
    v_business_context.business_date,
    v_order_json,
    v_customer.total,
    false;
end;
$$;

create or replace function public.transition_customer_order_status(
  p_customer_order_id uuid,
  p_next_status text,
  p_reason text default ''
)
returns table (
  customer_order_id uuid,
  previous_status text,
  current_status text,
  current_station_status text,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_order public.customer_orders%rowtype;
  v_next_status text := lower(trim(coalesce(p_next_status, '')));
  v_previous_status text;
  v_station_status text;
  v_now timestamptz := now();
  v_payment_method text;
begin
  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_next_status not in ('accepted', 'sent', 'delivered', 'cancelled') then
    raise exception 'Unsupported order status';
  end if;

  select co.* into v_order
  from public.customer_orders co
  where co.id = p_customer_order_id
    and co.user_id = v_owner_id
  for update;

  if not found then
    raise exception 'Customer order was not found';
  end if;

  v_previous_status := v_order.status;
  if v_previous_status = v_next_status then
    return query select
      v_order.id, v_previous_status, v_previous_status,
      v_order.station_status, v_order.updated_at;
    return;
  end if;

  if not (
    (v_previous_status = 'pending' and v_next_status = 'cancelled')
    or (v_previous_status = 'accepted' and v_next_status in ('sent', 'cancelled'))
    or (v_previous_status = 'sent' and v_next_status in ('delivered', 'cancelled'))
  ) then
    raise exception 'Invalid order status transition from % to %', v_previous_status, v_next_status;
  end if;

  v_payment_method := lower(trim(coalesce(
    nullif(v_order.payment_method, ''),
    v_order.order_json->>'paymentMethod',
    ''
  )));
  if v_next_status = 'delivered'
     and v_payment_method in ('online', 'pago en linea', 'online payment')
     and lower(trim(coalesce(v_order.payment_status, 'pending'))) <> 'paid' then
    raise exception 'Online payment is not confirmed';
  end if;

  v_station_status := case v_next_status
    when 'sent' then 'dispatched'
    when 'delivered' then 'completed'
    when 'cancelled' then 'cancelled'
    else v_order.station_status
  end;

  update public.customer_orders co
  set status = v_next_status,
      station_status = v_station_status,
      cancellation_reason = case when v_next_status = 'cancelled'
        then left(trim(coalesce(p_reason, '')), 500)
        else co.cancellation_reason
      end,
      cancelled_by = case when v_next_status = 'cancelled' then v_owner_id else co.cancelled_by end,
      cancelled_at = case when v_next_status = 'cancelled' then v_now else co.cancelled_at end,
      updated_at = v_now
  where co.id = v_order.id;

  return query select
    v_order.id,
    v_previous_status,
    v_next_status,
    v_station_status,
    v_now;
end;
$$;

revoke all on function public.rc_ordera_restaurant_timezone(uuid) from public;
revoke all on function public.get_restaurant_business_context(uuid) from public;
revoke all on function public.get_current_restaurant_business_context() from public;
revoke all on function public.claim_next_ticket(date) from public;
revoke all on function public.set_next_ticket(date, integer) from public;
revoke all on function public.accept_customer_order_atomic(uuid, uuid, text) from public;
revoke all on function public.transition_customer_order_status(uuid, text, text) from public;

grant execute on function public.get_restaurant_business_context(uuid) to authenticated;
grant execute on function public.get_current_restaurant_business_context() to authenticated;
grant execute on function public.claim_next_ticket(date) to authenticated;
grant execute on function public.set_next_ticket(date, integer) to authenticated;
grant execute on function public.accept_customer_order_atomic(uuid, uuid, text) to authenticated;
grant execute on function public.transition_customer_order_status(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
