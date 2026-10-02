-- RC ORDERA V91-30
-- P0: impedir cancelar un pedido online mientras exista un pago Stripe activo.
--
-- La cancelacion de pedidos online con checkout iniciado debe pasar por
-- supabase/functions/marketplace-cancel-order.
--
-- Esta migracion tambien serializa la creacion de nuevas payment_transactions
-- contra una cancelacion concurrente.
--
-- Incremental e idempotente.
-- No elimina pedidos, pagos ni historicos.

begin;


-- ============================================================
-- 1. PREFLIGHT
-- ============================================================

do $preflight$
begin

  if to_regclass('public.customer_orders') is null then
    raise exception 'Falta public.customer_orders';
  end if;

  if to_regclass('public.payment_transactions') is null then
    raise exception 'Falta public.payment_transactions';
  end if;

  if to_regprocedure(
    'public.transition_customer_order_status(uuid,text,text)'
  ) is null then
    raise exception
      'Falta transition_customer_order_status(uuid,text,text)';
  end if;

  if to_regprocedure(
    'public.rc_ordera_mark_payment_failed(uuid,text)'
  ) is null then
    raise exception
      'Falta rc_ordera_mark_payment_failed(uuid,text)';
  end if;

end;
$preflight$;


-- ============================================================
-- 2. PROTEGER CANCELACION DE PEDIDOS ONLINE
-- ============================================================

create or replace function
public.rc_ordera_guard_online_order_cancellation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare

  v_payment_method text;
  v_payment_status text;

begin

  if tg_op <> 'UPDATE' then
    return new;
  end if;


  -- Solo intervenir cuando el pedido entra por primera vez
  -- en estado cancelled.
  if lower(trim(coalesce(new.status, ''))) <> 'cancelled'
     or lower(trim(coalesce(old.status, ''))) = 'cancelled'
  then
    return new;
  end if;


  v_payment_method :=
    lower(trim(coalesce(
      nullif(old.payment_method, ''),
      old.order_json->>'paymentMethod',
      ''
    )));


  -- Pedidos que no son online siguen funcionando como antes.
  if v_payment_method not in (
    'online',
    'pago en linea',
    'pago en línea',
    'online payment'
  )
  then
    return new;
  end if;


  v_payment_status :=
    lower(trim(coalesce(
      old.payment_status,
      'pending'
    )));


  -- Si ya existe dinero cobrado, no podemos cancelar como si
  -- simplemente nunca hubiera existido el pago.
  if v_payment_status in (
    'paid',
    'partially_refunded'
  )
  then

    raise exception
      'ONLINE_PAYMENT_CANCELLATION_REQUIRES_REFUND'
    using
      errcode = 'P0001',
      detail =
        'Captured online funds must be reconciled/refunded before cancellation.';

  end if;


  -- Un intento activo debe resolverse por el gateway seguro.
  if exists (

    select 1

    from public.payment_transactions pt

    where pt.customer_order_id = old.id

      and pt.provider = 'stripe_connect'

      and pt.status in (
        'pending',
        'authorized',
        'paid',
        'partially_refunded'
      )

  )
  then

    raise exception
      'ONLINE_PAYMENT_CANCELLATION_REQUIRES_GATEWAY'
    using
      errcode = 'P0001',
      detail =
        'Resolve or expire active Stripe payment attempts before cancelling this order.';

  end if;


  return new;

end;
$$;


revoke all
on function public.rc_ordera_guard_online_order_cancellation()
from public, anon, authenticated;


grant execute
on function public.rc_ordera_guard_online_order_cancellation()
to service_role;


drop trigger if exists
rc_ordera_guard_online_order_cancellation
on public.customer_orders;


create trigger
rc_ordera_guard_online_order_cancellation
before update of status
on public.customer_orders
for each row
when (
  old.status is distinct from new.status
)
execute function
public.rc_ordera_guard_online_order_cancellation();



-- ============================================================
-- 3. SERIALIZAR CHECKOUT CONTRA CANCELACION
--
-- Evita:
--
-- checkout lee pending
-- restaurante cancela
-- checkout usa la lectura vieja
-- crea Stripe Checkout despues de cancelado
--
-- El FOR UPDATE hace que PostgreSQL serialice ambas operaciones.
-- ============================================================

create or replace function
public.rc_ordera_guard_stripe_checkout_reservation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare

  v_order_status text;
  v_payment_method text;

begin

  if new.provider <> 'stripe_connect'
     or new.status not in (
       'pending',
       'authorized',
       'paid'
     )
  then
    return new;
  end if;


  select

    lower(trim(coalesce(
      co.status,
      ''
    ))),

    lower(trim(coalesce(
      nullif(co.payment_method, ''),
      co.order_json->>'paymentMethod',
      ''
    )))

  into
    v_order_status,
    v_payment_method

  from public.customer_orders co

  where co.id = new.customer_order_id

  for update;


  if not found then

    raise exception
      'PAYMENT_CHECKOUT_ORDER_NOT_FOUND'
    using
      errcode = 'P0001';

  end if;


  if v_order_status <> 'pending' then

    raise exception
      'PAYMENT_CHECKOUT_ORDER_NOT_PENDING'
    using
      errcode = 'P0001',
      detail =
        'A new Stripe Checkout cannot be reserved after the order leaves pending.';

  end if;


  if v_payment_method not in (
    'online',
    'pago en linea',
    'pago en línea',
    'online payment'
  )
  then

    raise exception
      'PAYMENT_CHECKOUT_METHOD_MISMATCH'
    using
      errcode = 'P0001',
      detail =
        'Stripe Checkout can only be reserved for online orders.';

  end if;


  return new;

end;
$$;


revoke all
on function public.rc_ordera_guard_stripe_checkout_reservation()
from public, anon, authenticated;


grant execute
on function public.rc_ordera_guard_stripe_checkout_reservation()
to service_role;


drop trigger if exists
rc_ordera_guard_stripe_checkout_reservation
on public.payment_transactions;


create trigger
rc_ordera_guard_stripe_checkout_reservation
before insert
on public.payment_transactions
for each row
execute function
public.rc_ordera_guard_stripe_checkout_reservation();



-- ============================================================
-- 4. INDICE PARA BAJO COSTO BAJO CARGA
-- ============================================================

create index if not exists
payment_transactions_order_active_stripe_idx

on public.payment_transactions (
  customer_order_id,
  status
)

where provider = 'stripe_connect'

  and status in (
    'pending',
    'authorized',
    'paid',
    'partially_refunded'
  );



-- ============================================================
-- 5. VALIDACION
-- ============================================================

do $validation$
begin

  if to_regprocedure(
    'public.rc_ordera_guard_online_order_cancellation()'
  ) is null then

    raise exception
      'No se creo rc_ordera_guard_online_order_cancellation()';

  end if;


  if not exists (

    select 1

    from pg_trigger t

    join pg_class c
      on c.oid = t.tgrelid

    join pg_namespace n
      on n.oid = c.relnamespace

    where n.nspname = 'public'

      and c.relname = 'customer_orders'

      and t.tgname =
        'rc_ordera_guard_online_order_cancellation'

      and not t.tgisinternal

  )
  then

    raise exception
      'No se creo el trigger rc_ordera_guard_online_order_cancellation';

  end if;


  if to_regprocedure(
    'public.rc_ordera_guard_stripe_checkout_reservation()'
  ) is null then

    raise exception
      'No se creo rc_ordera_guard_stripe_checkout_reservation()';

  end if;


  if not exists (

    select 1

    from pg_trigger t

    join pg_class c
      on c.oid = t.tgrelid

    join pg_namespace n
      on n.oid = c.relnamespace

    where n.nspname = 'public'

      and c.relname =
        'payment_transactions'

      and t.tgname =
        'rc_ordera_guard_stripe_checkout_reservation'

      and not t.tgisinternal

  )
  then

    raise exception
      'No se creo el trigger rc_ordera_guard_stripe_checkout_reservation';

  end if;

end;
$validation$;


notify pgrst, 'reload schema';

commit;
