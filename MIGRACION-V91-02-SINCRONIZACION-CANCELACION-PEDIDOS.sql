-- RC ORDERA V91.02
-- Sincronizacion atomica de cancelaciones entre orders y customer_orders.
-- Incremental e idempotente.
-- No elimina pedidos, tickets ni historicos.

begin;

do $preflight$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.customer_orders') is null
     or to_regprocedure('public.void_restaurant_order(uuid,text)') is null
     or to_regprocedure('public.transition_customer_order_status(uuid,text,text)') is null then
    raise exception 'Falta la estructura de RC ORDERA V91. Ejecuta primero las migraciones hasta V91.01.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name in (
        'status',
        'canonical_status',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason'
      )
    group by table_schema, table_name
    having count(*) = 5
  ) then
    raise exception 'Faltan columnas de cancelacion de orders creadas en V91.01.';
  end if;
end;
$preflight$;


-- ============================================================
-- 1. CANCELAR UN TICKET DEL RESTAURANTE
--    Si proviene de customer_orders, cancela también el pedido
--    del cliente dentro de la MISMA transacción.
-- ============================================================

create or replace function public.void_restaurant_order(
  p_order_id uuid,
  p_reason text default ''
)
returns table(
  order_id uuid,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_reason text := left(trim(coalesce(p_reason, '')), 500);
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_order_id is null then
    raise exception 'Order id is required';
  end if;

  if v_reason = '' then
    v_reason := 'Cancelled by restaurant';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id
    and o.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;


  -- Si todavía no está anulado, anular el ticket operativo.
  if coalesce(v_order.canonical_status, '') <> 'cancelled' then

    update public.orders o
    set
      status = 'cancelled',
      canonical_status = 'cancelled',
      cancelled_at = v_now,
      cancelled_by = v_user_id,
      cancellation_reason = v_reason,

      order_json =
        coalesce(o.order_json, '{}'::jsonb)
        || jsonb_build_object(
          'status', 'cancelled',
          'canonicalStatus', 'cancelled',
          'cancelledAt', v_now,
          'cancelledBy', v_user_id,
          'cancellationReason', v_reason
        ),

      updated_at = v_now

    where o.id = p_order_id
      and o.user_id = v_user_id

    returning o.*
    into v_order;

    if not found then
      raise exception 'Order cancellation was not persisted';
    end if;

  end if;


  -- Si este ticket nació de customer_orders, mantener ambos lados
  -- sincronizados. No depende del JSON: usa la relación real
  -- restaurant_order_id.
  update public.customer_orders co
  set
    status = 'cancelled',
    station_status = 'cancelled',

    cancellation_reason =
      case
        when trim(coalesce(co.cancellation_reason, '')) = ''
          then v_reason
        else co.cancellation_reason
      end,

    cancelled_by = coalesce(co.cancelled_by, v_user_id),
    cancelled_at = coalesce(co.cancelled_at, v_now),
    updated_at = v_now

  where co.restaurant_order_id = p_order_id
    and co.user_id = v_user_id
    and co.status <> 'cancelled';


  return query
  select
    v_order.id,
    'cancelled'::text,
    greatest(coalesce(v_order.updated_at, v_now), v_now);
end;
$$;


revoke all
on function public.void_restaurant_order(uuid,text)
from public, anon;

grant execute
on function public.void_restaurant_order(uuid,text)
to authenticated;



-- ============================================================
-- 2. CAMBIAR ESTADO DE customer_orders
--    Cuando pasa a CANCELLED y ya existe ticket operativo,
--    anula también orders dentro de la MISMA transacción.
-- ============================================================

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
  v_reason text := left(trim(coalesce(p_reason, '')), 500);
begin

  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_next_status not in (
    'accepted',
    'sent',
    'delivered',
    'cancelled'
  ) then
    raise exception 'Unsupported order status';
  end if;


  select co.*
  into v_order
  from public.customer_orders co
  where co.id = p_customer_order_id
    and co.user_id = v_owner_id
  for update;

  if not found then
    raise exception 'Customer order was not found';
  end if;


  v_previous_status := v_order.status;


  -- Incluso si customer_orders ya aparece cancelado,
  -- reparar un posible ticket orders que haya quedado activo.
  if v_previous_status = v_next_status then

    if v_next_status = 'cancelled'
       and v_order.restaurant_order_id is not null then

      update public.orders o
      set
        status = 'cancelled',
        canonical_status = 'cancelled',
        cancelled_at = coalesce(o.cancelled_at, v_order.cancelled_at, v_now),
        cancelled_by = coalesce(o.cancelled_by, v_order.cancelled_by, v_owner_id),

        cancellation_reason =
          case
            when trim(coalesce(o.cancellation_reason, '')) = ''
              then coalesce(
                nullif(trim(v_order.cancellation_reason), ''),
                nullif(v_reason, ''),
                'Cancelled by restaurant'
              )
            else o.cancellation_reason
          end,

        order_json =
          coalesce(o.order_json, '{}'::jsonb)
          || jsonb_build_object(
            'status', 'cancelled',
            'canonicalStatus', 'cancelled',
            'cancelledAt',
              coalesce(o.cancelled_at, v_order.cancelled_at, v_now),
            'cancelledBy',
              coalesce(o.cancelled_by, v_order.cancelled_by, v_owner_id),
            'cancellationReason',
              coalesce(
                nullif(trim(o.cancellation_reason), ''),
                nullif(trim(v_order.cancellation_reason), ''),
                nullif(v_reason, ''),
                'Cancelled by restaurant'
              )
          ),

        updated_at = v_now

      where o.id = v_order.restaurant_order_id
        and o.user_id = v_owner_id
        and coalesce(o.canonical_status, '') <> 'cancelled';

    end if;


    return query
    select
      v_order.id,
      v_previous_status,
      v_previous_status,
      v_order.station_status,
      v_order.updated_at;

    return;
  end if;


  if not (
       (v_previous_status = 'pending'
          and v_next_status = 'cancelled')

    or (v_previous_status = 'accepted'
          and v_next_status in ('sent', 'cancelled'))

    or (v_previous_status = 'sent'
          and v_next_status in ('delivered', 'cancelled'))
  ) then

    raise exception
      'Invalid order status transition from % to %',
      v_previous_status,
      v_next_status;

  end if;


  v_payment_method := lower(trim(coalesce(
    nullif(v_order.payment_method, ''),
    v_order.order_json->>'paymentMethod',
    ''
  )));


  if v_next_status = 'delivered'
     and v_payment_method in (
       'online',
       'pago en linea',
       'online payment'
     )
     and lower(trim(coalesce(
       v_order.payment_status,
       'pending'
     ))) <> 'paid'
  then
    raise exception 'Online payment is not confirmed';
  end if;


  v_station_status := case v_next_status
    when 'sent' then 'dispatched'
    when 'delivered' then 'completed'
    when 'cancelled' then 'cancelled'
    else v_order.station_status
  end;


  -- Primero actualizamos customer_orders.
  update public.customer_orders co
  set
    status = v_next_status,
    station_status = v_station_status,

    cancellation_reason =
      case
        when v_next_status = 'cancelled'
          then coalesce(
            nullif(v_reason, ''),
            'Cancelled by restaurant'
          )
        else co.cancellation_reason
      end,

    cancelled_by =
      case
        when v_next_status = 'cancelled'
          then v_owner_id
        else co.cancelled_by
      end,

    cancelled_at =
      case
        when v_next_status = 'cancelled'
          then v_now
        else co.cancelled_at
      end,

    updated_at = v_now

  where co.id = v_order.id;


  -- Si la cancelación corresponde a un pedido que ya fue
  -- convertido en ticket del restaurante, cancelar también orders.
  if v_next_status = 'cancelled'
     and v_order.restaurant_order_id is not null then

    update public.orders o
    set
      status = 'cancelled',
      canonical_status = 'cancelled',
      cancelled_at = coalesce(o.cancelled_at, v_now),
      cancelled_by = coalesce(o.cancelled_by, v_owner_id),

      cancellation_reason =
        case
          when trim(coalesce(o.cancellation_reason, '')) = ''
            then coalesce(
              nullif(v_reason, ''),
              'Cancelled by restaurant'
            )
          else o.cancellation_reason
        end,

      order_json =
        coalesce(o.order_json, '{}'::jsonb)
        || jsonb_build_object(
          'status', 'cancelled',
          'canonicalStatus', 'cancelled',
          'cancelledAt', coalesce(o.cancelled_at, v_now),
          'cancelledBy', coalesce(o.cancelled_by, v_owner_id),
          'cancellationReason',
            coalesce(
              nullif(trim(o.cancellation_reason), ''),
              nullif(v_reason, ''),
              'Cancelled by restaurant'
            )
        ),

      updated_at = v_now

    where o.id = v_order.restaurant_order_id
      and o.user_id = v_owner_id;

  end if;


  return query
  select
    v_order.id,
    v_previous_status,
    v_next_status,
    v_station_status,
    v_now;
end;
$$;


revoke all
on function public.transition_customer_order_status(uuid,text,text)
from public, anon;

grant execute
on function public.transition_customer_order_status(uuid,text,text)
to authenticated;


notify pgrst, 'reload schema';

commit;
