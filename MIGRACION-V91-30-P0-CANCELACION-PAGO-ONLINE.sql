-- RC ORDERA V91-30
-- P0: impedir cancelar un pedido online mientras exista
--     un pago Stripe activo o una Checkout Session que
--     todavía pueda requerir conciliacion.
--
-- OBJETIVOS:
--
-- 1. Toda cancelacion de un pedido online con intento de
--    pago activo debe pasar por:
--
--    supabase/functions/marketplace-cancel-order
--
-- 2. Impedir:
--
--    pedido cancelled + pago capturado posteriormente.
--
-- 3. Serializar:
--
--    creacion Stripe Checkout
--                VS
--    cancelacion del pedido.
--
-- 4. Proteger intentos historicos marcados localmente como
--    failed que todavia conserven una Checkout Session
--    potencialmente activa.
--
-- Incremental.
-- Idempotente.
-- No elimina pedidos.
-- No elimina pagos.
-- No elimina historicos.
-- No modifica importes.
-- No modifica conciliaciones existentes.

begin;


-- ============================================================
-- 1. PREFLIGHT
-- ============================================================

do $preflight$
begin

  -- ----------------------------------------------------------
  -- Tablas base
  -- ----------------------------------------------------------

  if to_regclass(
    'public.customer_orders'
  ) is null then

    raise exception
      'Falta public.customer_orders';

  end if;


  if to_regclass(
    'public.payment_transactions'
  ) is null then

    raise exception
      'Falta public.payment_transactions';

  end if;


  -- ----------------------------------------------------------
  -- RPC base requerida
  -- ----------------------------------------------------------

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


  -- ----------------------------------------------------------
  -- Columnas necesarias en customer_orders
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_orders'
      and column_name = 'id'
  ) then

    raise exception
      'Falta customer_orders.id';

  end if;


  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_orders'
      and column_name = 'status'
  ) then

    raise exception
      'Falta customer_orders.status';

  end if;


  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_orders'
      and column_name = 'payment_method'
  ) then

    raise exception
      'Falta customer_orders.payment_method';

  end if;


  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_orders'
      and column_name = 'payment_status'
  ) then

    raise exception
      'Falta customer_orders.payment_status';

  end if;


  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_orders'
      and column_name = 'order_json'
  ) then

    raise exception
      'Falta customer_orders.order_json';

  end if;


  -- ----------------------------------------------------------
  -- Columnas necesarias en payment_transactions
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_transactions'
      and column_name = 'customer_order_id'
  ) then

    raise exception
      'Falta payment_transactions.customer_order_id';

  end if;


  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_transactions'
      and column_name = 'provider'
  ) then

    raise exception
      'Falta payment_transactions.provider';

  end if;


  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_transactions'
      and column_name = 'status'
  ) then

    raise exception
      'Falta payment_transactions.status';

  end if;


  /*
   * Estas dos columnas son necesarias para determinar
   * si una transaccion historica "failed" puede conservar
   * una Checkout Session Stripe todavia potencialmente viva.
   */

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_transactions'
      and column_name = 'provider_session_id'
  )
  or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_transactions'
      and column_name = 'expires_at'
  ) then

    raise exception
      'Faltan provider_session_id/expires_at en payment_transactions. Ejecuta primero V85-03.';

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

  -- Esta funcion solamente tiene sentido como trigger UPDATE.
  if tg_op <> 'UPDATE' then
    return new;
  end if;


  -- ----------------------------------------------------------
  -- Solo intervenir cuando un pedido ENTRA en cancelled.
  -- ----------------------------------------------------------

  if lower(
       trim(
         coalesce(
           new.status::text,
           ''
         )
       )
     ) <> 'cancelled'

     or

     lower(
       trim(
         coalesce(
           old.status::text,
           ''
         )
       )
     ) = 'cancelled'
  then

    return new;

  end if;


  -- ----------------------------------------------------------
  -- Determinar metodo de pago.
  --
  -- payment_method es la fuente principal.
  -- order_json es compatibilidad con pedidos anteriores.
  -- ----------------------------------------------------------

  v_payment_method :=
    lower(
      trim(
        coalesce(
          nullif(
            old.payment_method::text,
            ''
          ),
          old.order_json->>'paymentMethod',
          ''
        )
      )
    );


  -- ----------------------------------------------------------
  -- Pedidos NO online siguen usando exactamente el flujo
  -- anterior.
  --
  -- No alteramos efectivo, terminal, recogida ni delivery.
  -- ----------------------------------------------------------

  if v_payment_method not in (
    'online',
    'pago en linea',
    'pago en línea',
    'online payment'
  )
  then

    return new;

  end if;


  -- ----------------------------------------------------------
  -- Estado financiero actual conocido por RC ORDERA.
  -- ----------------------------------------------------------

  v_payment_status :=
    lower(
      trim(
        coalesce(
          old.payment_status::text,
          'pending'
        )
      )
    );


  -- ----------------------------------------------------------
  -- Dinero ya capturado.
  --
  -- No se puede tratar como una simple cancelacion.
  -- Debe entrar posteriormente en flujo refund/reconciliation.
  -- ----------------------------------------------------------

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


  -- ----------------------------------------------------------
  -- Existe una transaccion que requiere gateway seguro.
  --
  -- CASOS:
  --
  -- pending
  -- authorized
  -- paid
  -- partially_refunded
  --
  -- O:
  --
  -- failed histórico + Checkout Session conocida
  -- y sin evidencia local suficiente de expiracion.
  --
  -- El objetivo es FALLAR CERRADO cuando exista duda.
  -- ----------------------------------------------------------

  if exists (

    select 1

    from public.payment_transactions pt

    where pt.customer_order_id = old.id

      and lower(
        trim(
          coalesce(
            pt.provider::text,
            ''
          )
        )
      ) = 'stripe_connect'

      and (

        lower(
          trim(
            coalesce(
              pt.status::text,
              ''
            )
          )
        ) in (
          'pending',
          'authorized',
          'paid',
          'partially_refunded'
        )


        or


        (
          lower(
            trim(
              coalesce(
                pt.status::text,
                ''
              )
            )
          ) = 'failed'

          and nullif(
            trim(
              coalesce(
                pt.provider_session_id::text,
                ''
              )
            ),
            ''
          ) is not null

          /*
           * Si expires_at es NULL no tenemos evidencia local
           * de que Stripe haya cerrado la Session.
           *
           * Si expires_at esta en el futuro, tampoco puede
           * considerarse resuelta.
           *
           * marketplace-cancel-order sera quien consulte Stripe.
           */
          and (
            pt.expires_at is null
            or pt.expires_at > statement_timestamp()
          )
        )

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



-- ------------------------------------------------------------
-- El trigger usa SECURITY DEFINER porque necesita ver todos
-- los payment_transactions relacionados incluso cuando el
-- usuario autenticado esta sujeto a RLS.
--
-- No exponemos la funcion directamente a usuarios.
-- ------------------------------------------------------------

revoke all
on function
public.rc_ordera_guard_online_order_cancellation()
from public, anon, authenticated;


grant execute
on function
public.rc_ordera_guard_online_order_cancellation()
to service_role;



-- ------------------------------------------------------------
-- Reinstalacion idempotente del trigger.
-- ------------------------------------------------------------

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
-- ============================================================
--
-- PROBLEMA QUE IMPIDE:
--
-- Worker Checkout:
--
--   lee order = pending
--
-- Restaurante:
--
--   cancela
--
-- Worker Checkout:
--
--   usa informacion antigua
--   crea payment_transaction
--   crea Stripe Checkout
--
--
-- SOLUCION:
--
-- El INSERT de payment_transactions obtiene FOR UPDATE
-- sobre customer_orders.
--
-- PostgreSQL serializa ambas operaciones.
--
-- Si la cancelacion gana:
--   el INSERT vera cancelled y fallara.
--
-- Si Checkout gana:
--   la cancelacion vera la transaccion Stripe y debera
--   pasar por marketplace-cancel-order.
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

  -- ----------------------------------------------------------
  -- No modificar proveedores ajenos a Stripe.
  -- Tampoco alterar filas que no representan una reserva
  -- financiera relevante.
  -- ----------------------------------------------------------

  if lower(
       trim(
         coalesce(
           new.provider::text,
           ''
         )
       )
     ) <> 'stripe_connect'

     or

     lower(
       trim(
         coalesce(
           new.status::text,
           ''
         )
       )
     ) not in (
       'pending',
       'authorized',
       'paid'
     )
  then

    return new;

  end if;


  -- ----------------------------------------------------------
  -- Bloqueo de la fila del pedido.
  --
  -- Este FOR UPDATE es la barrera contra la carrera entre
  -- crear Checkout y cancelar el pedido.
  -- ----------------------------------------------------------

  select

    lower(
      trim(
        coalesce(
          co.status::text,
          ''
        )
      )
    ),

    lower(
      trim(
        coalesce(
          nullif(
            co.payment_method::text,
            ''
          ),
          co.order_json->>'paymentMethod',
          ''
        )
      )
    )

  into
    v_order_status,
    v_payment_method

  from public.customer_orders co

  where co.id =
    new.customer_order_id

  for update;


  -- ----------------------------------------------------------
  -- Integridad referencial defensiva.
  -- ----------------------------------------------------------

  if not found then

    raise exception
      'PAYMENT_CHECKOUT_ORDER_NOT_FOUND'
    using

      errcode = 'P0001',

      detail =
        'The payment transaction references an order that does not exist.';

  end if;


  -- ----------------------------------------------------------
  -- Solo se puede reservar un NUEVO Checkout mientras el
  -- pedido continua pending.
  -- ----------------------------------------------------------

  if v_order_status <> 'pending' then

    raise exception
      'PAYMENT_CHECKOUT_ORDER_NOT_PENDING'
    using

      errcode = 'P0001',

      detail =
        'A new Stripe Checkout cannot be reserved after the order leaves pending.';

  end if;


  -- ----------------------------------------------------------
  -- Stripe Checkout online solamente.
  -- ----------------------------------------------------------

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
on function
public.rc_ordera_guard_stripe_checkout_reservation()
from public, anon, authenticated;


grant execute
on function
public.rc_ordera_guard_stripe_checkout_reservation()
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
-- 4. INDICE PARA EL GUARD DE CANCELACION
-- ============================================================
--
-- Se usa un nombre NUEVO deliberadamente.
--
-- De esta forma, incluso si una revision anterior de V91-30
-- llego a crear payment_transactions_order_active_stripe_idx,
-- esta version obtiene igualmente el indice correcto.
--
-- Incluimos FAILED porque ahora tambien se inspeccionan
-- Checkout Sessions historicas potencialmente vivas.
-- ============================================================

create index if not exists
payment_transactions_order_cancel_guard_idx

on public.payment_transactions (
  customer_order_id,
  status,
  expires_at
)

where provider = 'stripe_connect'

  and status in (
    'pending',
    'authorized',
    'paid',
    'partially_refunded',
    'failed'
  );



-- ============================================================
-- 5. VALIDACION POST-INSTALACION
-- ============================================================

do $validation$
begin

  -- ----------------------------------------------------------
  -- Funcion guard cancelacion
  -- ----------------------------------------------------------

  if to_regprocedure(
    'public.rc_ordera_guard_online_order_cancellation()'
  ) is null then

    raise exception
      'No se creo rc_ordera_guard_online_order_cancellation()';

  end if;


  -- ----------------------------------------------------------
  -- Trigger cancelacion
  -- ----------------------------------------------------------

  if not exists (

    select 1

    from pg_trigger t

    join pg_class c
      on c.oid = t.tgrelid

    join pg_namespace n
      on n.oid = c.relnamespace

    where n.nspname = 'public'

      and c.relname =
        'customer_orders'

      and t.tgname =
        'rc_ordera_guard_online_order_cancellation'

      and not t.tgisinternal

  )
  then

    raise exception
      'No se creo el trigger rc_ordera_guard_online_order_cancellation';

  end if;


  -- ----------------------------------------------------------
  -- Funcion guard Checkout
  -- ----------------------------------------------------------

  if to_regprocedure(
    'public.rc_ordera_guard_stripe_checkout_reservation()'
  ) is null then

    raise exception
      'No se creo rc_ordera_guard_stripe_checkout_reservation()';

  end if;


  -- ----------------------------------------------------------
  -- Trigger Checkout
  -- ----------------------------------------------------------

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


  -- ----------------------------------------------------------
  -- Indice esperado
  -- ----------------------------------------------------------

  if to_regclass(
    'public.payment_transactions_order_cancel_guard_idx'
  ) is null then

    raise exception
      'No se creo payment_transactions_order_cancel_guard_idx';

  end if;

end;
$validation$;



-- ============================================================
-- 6. RECARGAR CACHE POSTGREST
-- ============================================================

notify pgrst, 'reload schema';


commit;
