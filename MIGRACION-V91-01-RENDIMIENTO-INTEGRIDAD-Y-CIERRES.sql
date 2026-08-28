-- RC ORDERA V91
-- Rendimiento, cierres server-side, cancelacion historica y entregas atomicas.
-- Incremental e idempotente. No elimina tablas, usuarios, pedidos ni historicos.

begin;

do $preflight$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.customer_orders') is null
     or to_regclass('public.delivery_assignments') is null
     or to_regclass('public.courier_live_locations') is null
     or to_regclass('public.courier_profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.app_settings') is null
     or to_regprocedure('public.rc_ordera_offer_next_courier(uuid,uuid)') is null
     or to_regprocedure('public.rc_ordera_jsonb_numeric(jsonb,numeric)') is null then
    raise exception 'Falta el nucleo de RC ORDERA. Ejecuta primero las migraciones publicadas hasta V89.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'delivery_assignments'
      and column_name in ('delivered_at', 'delivered_lat', 'delivered_lng', 'offer_expires_at')
    group by table_schema, table_name
    having count(*) = 4
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_orders'
      and column_name in ('assigned_courier_user_id', 'courier_assignment_status', 'cancelled_by', 'cancelled_at')
    group by table_schema, table_name
    having count(*) = 4
  ) then
    raise exception 'Faltan columnas de entregas de RC ORDERA. Ejecuta primero las migraciones V82 a V89.';
  end if;
end;
$preflight$;

alter table public.orders
  add column if not exists status text not null default 'completed',
  add column if not exists canonical_status text not null default 'completed',
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancelled_by uuid null references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text not null default '';

create index if not exists orders_owner_business_status_idx
  on public.orders (user_id, business_date desc, canonical_status, created_at desc);

create or replace function public.get_rc_ordera_schema_version()
returns table(schema_version integer, release text)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select 91, 'RC ORDERA V91'::text;
$$;

revoke all on function public.get_rc_ordera_schema_version() from public, anon;
grant execute on function public.get_rc_ordera_schema_version() to authenticated;

create or replace function public.void_restaurant_order(
  p_order_id uuid,
  p_reason text default ''
)
returns table(order_id uuid, status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_reason text := left(trim(coalesce(p_reason, '')), 500);
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_order_id is null then raise exception 'Order id is required'; end if;
  if v_reason = '' then v_reason := 'Cancelled by restaurant'; end if;

  select o.* into v_order
  from public.orders o
  where o.id = p_order_id and o.user_id = v_user_id
  for update;
  if not found then raise exception 'Order not found'; end if;

  if v_order.canonical_status = 'cancelled' then
    return query select v_order.id, v_order.canonical_status, v_order.updated_at;
    return;
  end if;

  update public.orders o
  set status = 'cancelled',
      canonical_status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_user_id,
      cancellation_reason = v_reason,
      order_json = coalesce(o.order_json, '{}'::jsonb) || jsonb_build_object(
        'status', 'cancelled',
        'canonicalStatus', 'cancelled',
        'cancelledAt', now(),
        'cancelledBy', v_user_id,
        'cancellationReason', v_reason
      ),
      updated_at = now()
  where o.id = p_order_id and o.user_id = v_user_id
  returning o.id, o.canonical_status, o.updated_at
  into v_order.id, v_order.canonical_status, v_order.updated_at;

  if not found then raise exception 'Order cancellation was not persisted'; end if;
  return query select v_order.id, v_order.canonical_status, v_order.updated_at;
end;
$$;

revoke all on function public.void_restaurant_order(uuid,text) from public, anon;
grant execute on function public.void_restaurant_order(uuid,text) to authenticated;

create or replace function public.get_restaurant_closure_report(
  p_period_type text,
  p_period_value text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_type text := lower(trim(coalesce(p_period_type, '')));
  v_value text := trim(coalesce(p_period_value, ''));
  v_start date;
  v_end date;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  if v_type = 'day' and v_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    v_start := v_value::date;
    v_end := v_start + 1;
  elsif v_type = 'month' and v_value ~ '^[0-9]{4}-[0-9]{2}$' then
    v_start := (v_value || '-01')::date;
    v_end := (v_start + interval '1 month')::date;
  elsif v_type = 'year' and v_value ~ '^[0-9]{4}$' then
    v_start := (v_value || '-01-01')::date;
    v_end := (v_start + interval '1 year')::date;
  else
    raise exception 'Invalid closure period';
  end if;

  with base as (
    select
      o.id,
      o.ticket_number,
      o.business_date,
      o.total,
      o.order_json,
      coalesce(nullif(o.canonical_status, ''), nullif(o.status, ''), o.order_json->>'canonicalStatus', o.order_json->>'status', 'completed') as effective_status,
      coalesce(nullif(o.order_json->>'type', ''), 'unknown') as order_type,
      coalesce(nullif(o.order_json->>'paymentMethod', ''), 'unknown') as payment_method,
      coalesce(nullif(o.order_json->>'server', ''), 'unknown') as server_name
    from public.orders o
    where o.user_id = v_user_id
      and o.business_date >= v_start
      and o.business_date < v_end
  ),
  sales as (
    select * from base where effective_status <> 'cancelled'
  ),
  items as (
    select
      s.id as order_id,
      s.business_date,
      coalesce(nullif(i.item->>'name', ''), nullif(i.item->>'product_name_snapshot', ''), 'Producto') as product_name,
      greatest(public.rc_ordera_jsonb_numeric(coalesce(i.item->'qty', i.item->'quantity'), 1), 1) as qty,
      case
        when coalesce(i.item->'lineTotal', i.item->'total_snapshot') is not null
          then public.rc_ordera_jsonb_numeric(coalesce(i.item->'lineTotal', i.item->'total_snapshot'), 0)
        else greatest(public.rc_ordera_jsonb_numeric(coalesce(i.item->'qty', i.item->'quantity'), 1), 1)
          * public.rc_ordera_jsonb_numeric(coalesce(i.item->'price', i.item->'unit_price_snapshot'), 0)
      end as line_total
    from sales s
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(s.order_json->'items') = 'array' then s.order_json->'items' else '[]'::jsonb end
    ) i(item)
  ),
  summary as (
    select
      count(*)::integer as tickets,
      coalesce(sum(s.total), 0)::numeric as total,
      coalesce(avg(s.total), 0)::numeric as average,
      min(s.ticket_number)::integer as first_ticket,
      max(s.ticket_number)::integer as last_ticket
    from sales s
  )
  select jsonb_build_object(
    'periodType', v_type,
    'periodValue', v_value,
    'startDate', v_start,
    'endDate', v_end,
    'tickets', summary.tickets,
    'items', coalesce((select sum(items.qty) from items), 0),
    'total', summary.total,
    'average', summary.average,
    'firstTicket', summary.first_ticket,
    'lastTicket', summary.last_ticket,
    'cancelled', (select count(*) from base where effective_status = 'cancelled'),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', d.business_date,
        'tickets', d.tickets,
        'items', d.items,
        'total', d.total
      ) order by d.business_date)
      from (
        select s.business_date, count(*)::integer tickets,
          coalesce((select sum(i.qty) from items i where i.business_date = s.business_date), 0) items,
          coalesce(sum(s.total), 0) total
        from sales s group by s.business_date
      ) d
    ), '[]'::jsonb),
    'months', coalesce((
      select jsonb_agg(jsonb_build_object(
        'month', m.month_key,
        'tickets', m.tickets,
        'items', m.items,
        'total', m.total
      ) order by m.month_key)
      from (
        select to_char(s.business_date, 'YYYY-MM') month_key, count(*)::integer tickets,
          coalesce((select sum(i.qty) from items i where to_char(i.business_date, 'YYYY-MM') = to_char(s.business_date, 'YYYY-MM')), 0) items,
          coalesce(sum(s.total), 0) total
        from sales s group by to_char(s.business_date, 'YYYY-MM')
      ) m
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.product_name, 'qty', p.qty, 'total', p.total) order by p.qty desc, p.total desc)
      from (select product_name, sum(qty) qty, sum(line_total) total from items group by product_name) p
    ), '[]'::jsonb),
    'orderTypes', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.order_type, 'count', x.tickets, 'total', x.total) order by x.total desc)
      from (select order_type, count(*)::integer tickets, sum(total) total from sales group by order_type) x
    ), '[]'::jsonb),
    'paymentMethods', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.payment_method, 'count', x.tickets, 'total', x.total) order by x.total desc)
      from (select payment_method, count(*)::integer tickets, sum(total) total from sales group by payment_method) x
    ), '[]'::jsonb),
    'servers', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.server_name, 'count', x.tickets, 'total', x.total) order by x.total desc)
      from (select server_name, count(*)::integer tickets, sum(total) total from sales group by server_name) x
    ), '[]'::jsonb)
  ) into v_result
  from summary;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_restaurant_closure_report(text,text) from public, anon;
grant execute on function public.get_restaurant_closure_report(text,text) to authenticated;

-- Una lectura no expira ni reasigna ofertas. El mantenimiento queda separado.
create or replace function public.get_courier_delivery_offers()
returns table(
  assignment_id uuid,
  customer_order_id uuid,
  restaurant_user_id uuid,
  restaurant_name text,
  status text,
  order_status text,
  order_type text,
  customer_name text,
  table_label text,
  order_json jsonb,
  total numeric,
  distance_km numeric,
  pickup_lat numeric,
  pickup_lng numeric,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1
    from public.courier_profiles cp
    join public.user_roles ur on ur.user_id = cp.user_id
      and ur.role = 'platform_courier'
      and ur.status = 'active'
    where cp.user_id = v_user_id and cp.status = 'approved'
  ) then raise exception 'Courier profile is not approved'; end if;

  return query
  select da.id, co.id, da.restaurant_user_id,
    coalesce(nullif(rp.business_name, ''), nullif(s.settings->>'businessName', ''), 'Restaurante')::text,
    da.status, co.status, co.order_type, co.customer_name, co.table_label,
    co.order_json, co.total, da.distance_km, da.pickup_lat, da.pickup_lng,
    da.created_at, da.updated_at
  from public.delivery_assignments da
  join public.customer_orders co on co.id = da.customer_order_id
  left join public.restaurant_profiles rp on rp.user_id = da.restaurant_user_id
  left join public.app_settings s on s.user_id = da.restaurant_user_id
  where da.courier_user_id = v_user_id
    and (
      da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
      or (da.status = 'offered' and da.offer_expires_at > now())
    )
  order by da.created_at asc;
end;
$$;

revoke all on function public.get_courier_delivery_offers() from public, anon;
grant execute on function public.get_courier_delivery_offers() to authenticated;

create or replace function public.process_expired_delivery_offers(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_expired record;
  v_processed integer := 0;
begin
  for v_expired in
    select da.id, da.customer_order_id, da.restaurant_user_id, da.courier_user_id
    from public.delivery_assignments da
    where da.status = 'offered' and da.offer_expires_at <= now()
    order by da.offer_expires_at asc
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update skip locked
  loop
    update public.delivery_assignments da
    set status = 'expired', updated_at = now()
    where da.id = v_expired.id and da.status = 'offered' and da.offer_expires_at <= now();
    if found then
      update public.customer_orders co
      set assigned_courier_user_id = null, courier_assignment_status = 'expired', updated_at = now()
      where co.id = v_expired.customer_order_id
        and co.assigned_courier_user_id = v_expired.courier_user_id
        and co.courier_assignment_status = 'offered';
      perform 1 from public.rc_ordera_offer_next_courier(v_expired.customer_order_id, v_expired.restaurant_user_id) limit 1;
      v_processed := v_processed + 1;
    end if;
  end loop;
  return v_processed;
end;
$$;

revoke all on function public.process_expired_delivery_offers(integer) from public, anon, authenticated;
grant execute on function public.process_expired_delivery_offers(integer) to service_role;

create or replace function public.update_delivery_assignment_status(
  p_assignment_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_assignment public.delivery_assignments%rowtype;
  v_order public.customer_orders%rowtype;
  v_is_courier boolean;
  v_live_lat numeric;
  v_live_lng numeric;
  v_rows integer;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if v_status not in ('accepted', 'rejected', 'arrived_restaurant', 'picked_up', 'arrived_customer', 'delivered', 'cancelled') then
    raise exception 'Invalid assignment status';
  end if;

  select da.* into v_assignment
  from public.delivery_assignments da
  where da.id = p_assignment_id
    and (da.courier_user_id = v_user_id or da.restaurant_user_id = v_user_id)
  for update;
  if not found then raise exception 'Assignment not found'; end if;

  select co.* into v_order
  from public.customer_orders co
  where co.id = v_assignment.customer_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;

  v_is_courier := v_user_id = v_assignment.courier_user_id;
  if v_assignment.status = v_status then return; end if;
  if v_assignment.status in ('delivered', 'cancelled', 'rejected', 'expired') then raise exception 'Assignment transition is not allowed'; end if;
  if v_is_courier and v_status = 'cancelled' then raise exception 'Courier cannot cancel the order'; end if;

  if not v_is_courier and v_status = 'cancelled' then
    update public.delivery_assignments set status = 'cancelled', updated_at = now()
    where id = v_assignment.id and status = v_assignment.status;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Assignment changed concurrently'; end if;
    update public.customer_orders
    set status = 'cancelled', courier_assignment_status = 'cancelled', assigned_courier_user_id = null,
        cancelled_by = v_user_id, cancelled_at = now(), updated_at = now()
    where id = v_assignment.customer_order_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Order cancellation was not persisted'; end if;
    return;
  end if;

  if not v_is_courier then raise exception 'Only the assigned courier can advance delivery stages'; end if;
  if v_assignment.status = 'offered' and v_assignment.offer_expires_at <= now() then raise exception 'Offer expired'; end if;

  if v_status = 'accepted' then
    if v_assignment.status <> 'offered'
       or v_order.assigned_courier_user_id is distinct from v_assignment.courier_user_id
       or v_order.courier_assignment_status <> 'offered'
       or not exists (select 1 from public.courier_live_locations cl where cl.user_id = v_assignment.courier_user_id and cl.available = true)
    then raise exception 'Offer is no longer available'; end if;
    update public.delivery_assignments set status = 'accepted', updated_at = now()
    where id = v_assignment.id and status = 'offered' and offer_expires_at > now();
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Offer is no longer available'; end if;
    update public.delivery_assignments set status = 'expired', updated_at = now()
    where customer_order_id = v_assignment.customer_order_id and id <> v_assignment.id and status = 'offered';
    update public.customer_orders
    set assigned_courier_user_id = v_assignment.courier_user_id, courier_assignment_status = 'accepted', status = 'accepted', updated_at = now()
    where id = v_assignment.customer_order_id and assigned_courier_user_id = v_assignment.courier_user_id and courier_assignment_status = 'offered';
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Order changed concurrently'; end if;
    return;
  end if;

  if v_status = 'rejected' then
    if v_assignment.status <> 'offered' then raise exception 'Offer is no longer available'; end if;
    update public.delivery_assignments set status = 'rejected', updated_at = now()
    where id = v_assignment.id and status = 'offered';
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Offer is no longer available'; end if;
    update public.customer_orders
    set assigned_courier_user_id = null, courier_assignment_status = 'rejected', updated_at = now()
    where id = v_assignment.customer_order_id and assigned_courier_user_id = v_assignment.courier_user_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Order changed concurrently'; end if;
    perform 1 from public.rc_ordera_offer_next_courier(v_assignment.customer_order_id, v_assignment.restaurant_user_id) limit 1;
    return;
  end if;

  if not (
    (v_assignment.status = 'accepted' and v_status = 'arrived_restaurant')
    or (v_assignment.status = 'arrived_restaurant' and v_status = 'picked_up')
    or (v_assignment.status = 'picked_up' and v_status = 'arrived_customer')
    or (v_assignment.status = 'arrived_customer' and v_status = 'delivered')
  ) then raise exception 'Assignment transition is not allowed'; end if;

  select cl.lat, cl.lng into v_live_lat, v_live_lng
  from public.courier_live_locations cl where cl.user_id = v_assignment.courier_user_id;

  update public.delivery_assignments da
  set status = v_status,
      delivered_at = case when v_status = 'delivered' then now() else da.delivered_at end,
      delivered_lat = case when v_status = 'delivered' then coalesce(v_live_lat, da.delivered_lat) else da.delivered_lat end,
      delivered_lng = case when v_status = 'delivered' then coalesce(v_live_lng, da.delivered_lng) else da.delivered_lng end,
      updated_at = now()
  where da.id = v_assignment.id and da.status = v_assignment.status;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Assignment changed concurrently'; end if;

  update public.customer_orders co
  set courier_assignment_status = v_status,
      status = case when v_status = 'picked_up' then 'sent' when v_status = 'delivered' then 'delivered' else co.status end,
      updated_at = now()
  where co.id = v_assignment.customer_order_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Order status was not persisted'; end if;
end;
$$;

revoke all on function public.update_delivery_assignment_status(uuid,text) from public, anon;
grant execute on function public.update_delivery_assignment_status(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
