-- RC ORDERA V91-11
-- Inmutabilidad financiera de pedidos marketplace.
--
-- Objetivos:
-- 1. Congelar los importes que determinan la distribucion del dinero
--    una vez iniciado un checkout valido.
-- 2. Evitar que una RPC presente o futura pueda cambiar silenciosamente
--    subtotal, domicilio, descuento, total o restaurante despues del checkout.
-- 3. Revalidar todos los importes antes de crear una allocation.
--
-- No modifica historicos.
-- No modifica pagos existentes.
-- No modifica estados de pedidos.
-- No modifica order_json.
-- No modifica payment_status/payment_amount/provider_reference.

begin;


-- ============================================================
-- 1. PREFLIGHT
-- ============================================================

do $preflight$
begin

  if to_regclass('public.customer_orders') is null then
    raise exception
      'Falta public.customer_orders.';
  end if;

  if to_regclass('public.payment_transactions') is null then
    raise exception
      'Falta public.payment_transactions. Ejecuta primero V84/V85.';
  end if;

  if to_regclass('public.marketplace_payment_allocations') is null then
    raise exception
      'Falta public.marketplace_payment_allocations. Ejecuta primero V85-03.';
  end if;

  if to_regclass('public.marketplace_finance_config') is null then
    raise exception
      'Falta public.marketplace_finance_config. Ejecuta primero V85-03.';
  end if;

  if to_regprocedure(
    'public.rc_ordera_calculate_marketplace_allocation(uuid)'
  ) is null then
    raise exception
      'Falta rc_ordera_calculate_marketplace_allocation(uuid). Ejecuta primero V85-03.';
  end if;


  -- V91-10 debe estar aplicada.
  if has_table_privilege(
    'authenticated',
    'public.customer_orders',
    'UPDATE'
  ) then
    raise exception
      'V91-10 no esta aplicada: authenticated todavia tiene UPDATE sobre customer_orders';
  end if;

end;
$preflight$;


-- ============================================================
-- 2. BLOQUEAR LA FUENTE FINANCIERA DESPUES DEL CHECKOUT
--
-- En cuanto existe una payment_transaction no fallida,
-- los importes utilizados para cobrar y repartir el dinero
-- pasan a ser inmutables.
--
-- IMPORTANTE:
-- NO bloqueamos:
--
-- payment_status
-- payment_provider
-- payment_amount
-- payment_currency
-- provider_reference
-- paid_at
-- status
-- canonical_status
-- order_json
-- restaurant_order_id
-- courier_assignment_status
--
-- Esos campos siguen siendo necesarios para el flujo normal.
-- ============================================================

create or replace function
public.rc_ordera_lock_marketplace_pricing_after_checkout()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin

  -- Si nunca se ha iniciado checkout, esta proteccion
  -- no necesita intervenir.
  if not exists (
    select 1
    from public.payment_transactions pt
    where pt.customer_order_id = old.id
      and pt.status <> 'failed'
  ) then
    return new;
  end if;


  -- ----------------------------------------------------------
  -- RESTAURANTE DESTINATARIO
  -- ----------------------------------------------------------

  if new.user_id is distinct from old.user_id then
    raise exception 'MARKETPLACE_PRICING_LOCKED'
      using
        errcode = '42501',
        detail = 'Restaurant cannot change after marketplace checkout starts.';
  end if;


  -- ----------------------------------------------------------
  -- TOTAL / MONEDA
  -- ----------------------------------------------------------

  if new.total is distinct from old.total
     or new.currency is distinct from old.currency then

    raise exception 'MARKETPLACE_PRICING_LOCKED'
      using
        errcode = '42501',
        detail = 'Order total or currency cannot change after marketplace checkout starts.';

  end if;


  -- ----------------------------------------------------------
  -- PRODUCTOS / SUBTOTAL / DESCUENTOS
  -- ----------------------------------------------------------

  if new.subtotal is distinct from old.subtotal
     or new.discount_amount is distinct from old.discount_amount then

    raise exception 'MARKETPLACE_PRICING_LOCKED'
      using
        errcode = '42501',
        detail = 'Order subtotal or discount cannot change after marketplace checkout starts.';

  end if;


  -- ----------------------------------------------------------
  -- COSTOS DE ENTREGA
  -- ----------------------------------------------------------

  if new.base_delivery_fee
       is distinct from old.base_delivery_fee

     or new.distance_fee
       is distinct from old.distance_fee

     or new.operational_adjustment
       is distinct from old.operational_adjustment

     or new.platform_adjustment
       is distinct from old.platform_adjustment

     or new.final_delivery_fee
       is distinct from old.final_delivery_fee then

    raise exception 'MARKETPLACE_PRICING_LOCKED'
      using
        errcode = '42501',
        detail = 'Delivery financial components cannot change after marketplace checkout starts.';

  end if;


  -- ----------------------------------------------------------
  -- PROPINA
  -- ----------------------------------------------------------

  if new.tip_amount is distinct from old.tip_amount
     or new.tip_currency is distinct from old.tip_currency then

    raise exception 'MARKETPLACE_PRICING_LOCKED'
      using
        errcode = '42501',
        detail = 'Tip financial fields cannot change after marketplace checkout starts.';

  end if;


  return new;

end;
$$;


-- La funcion existe exclusivamente para el trigger.
-- El navegador no debe poder invocarla como RPC.

revoke all
on function public.rc_ordera_lock_marketplace_pricing_after_checkout()
from public, anon, authenticated;


drop trigger if exists
  rc_ordera_lock_marketplace_pricing_after_checkout
on public.customer_orders;


create trigger
  rc_ordera_lock_marketplace_pricing_after_checkout

before update of

  user_id,
  total,
  currency,
  subtotal,
  base_delivery_fee,
  distance_fee,
  operational_adjustment,
  platform_adjustment,
  final_delivery_fee,
  discount_amount,
  tip_amount,
  tip_currency

on public.customer_orders

for each row

execute function
  public.rc_ordera_lock_marketplace_pricing_after_checkout();


-- ============================================================
-- 3. ENDURECER EL CALCULO DE DISTRIBUCION
--
-- No confiamos ciegamente en customer_orders.
--
-- Antes de repartir:
--
-- payment debe estar PAID
-- customer_order debe estar PAID
-- payment.amount = customer_orders.total
-- payment.currency = customer_orders.currency
-- subtotal >= 0
-- delivery >= 0
-- discount >= 0
-- discount <= subtotal
--
-- Para los pedidos creados por el pricing server V82/V86
-- verificamos tambien reconciliacion exacta.
-- ============================================================

create or replace function
public.rc_ordera_calculate_marketplace_allocation(
  p_payment_transaction_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare

  v_payment public.payment_transactions%rowtype;

  v_order public.customer_orders%rowtype;

  v_config public.marketplace_finance_config%rowtype;

  v_courier_id uuid;

  v_restaurant_gross numeric(12,2);

  v_delivery_gross numeric(12,2);

  v_restaurant_fee numeric(12,2);

  v_courier_fee numeric(12,2);

  v_restaurant_net numeric(12,2);

  v_courier_net numeric(12,2);

  v_platform numeric(12,2);

  v_expected_gross numeric(12,2);

  v_pricing_source text;

  v_id uuid;

begin


  -- ==========================================================
  -- PAYMENT TRANSACTION
  -- ==========================================================

  select pt.*
  into v_payment

  from public.payment_transactions pt

  where pt.id = p_payment_transaction_id

  for update;


  if not found then
    raise exception 'Payment transaction was not found';
  end if;


  if v_payment.status <> 'paid' then
    raise exception 'Payment is not settled';
  end if;


  if coalesce(v_payment.amount, 0) <= 0 then
    raise exception 'Invalid payment amount';
  end if;


  if trim(coalesce(v_payment.currency, '')) = '' then
    raise exception 'Invalid payment currency';
  end if;


  -- ==========================================================
  -- CUSTOMER ORDER
  -- ==========================================================

  select co.*
  into v_order

  from public.customer_orders co

  where co.id = v_payment.customer_order_id

  for update;


  if not found then
    raise exception 'Order was not found';
  end if;


  -- El webhook marca primero el pedido como paid.
  -- La allocation nunca debe aparecer para un pedido no pagado.

  if lower(
    trim(
      coalesce(
        v_order.payment_status,
        ''
      )
    )
  ) <> 'paid' then

    raise exception
      'Order is not marked as paid';

  end if;


  -- ==========================================================
  -- TOTAL AUTORITATIVO
  -- ==========================================================

  if round(v_order.total, 2)
     <> round(v_payment.amount, 2) then

    raise exception
      'Order total does not match payment amount';

  end if;


  if upper(
       trim(
         coalesce(
           v_order.currency,
           ''
         )
       )
     )
     <>
     upper(
       trim(
         coalesce(
           v_payment.currency,
           ''
         )
       )
     ) then

    raise exception
      'Order currency does not match payment currency';

  end if;


  -- ==========================================================
  -- SANIDAD DE COMPONENTES FINANCIEROS
  -- ==========================================================

  if coalesce(v_order.subtotal, 0) < 0 then
    raise exception
      'Invalid order subtotal';
  end if;


  if coalesce(v_order.final_delivery_fee, 0) < 0 then
    raise exception
      'Invalid delivery amount';
  end if;


  if coalesce(v_order.discount_amount, 0) < 0 then
    raise exception
      'Invalid discount amount';
  end if;


  if coalesce(v_order.discount_amount, 0)
     > coalesce(v_order.subtotal, 0) then

    raise exception
      'Discount exceeds subtotal';

  end if;


  if coalesce(v_order.tip_amount, 0) < 0 then
    raise exception
      'Invalid tip amount';
  end if;


  -- ==========================================================
  -- RECONCILIACION PARA PEDIDOS GENERADOS POR SERVIDOR
  --
  -- V82 y V86 calculan:
  --
  -- total = subtotal + final_delivery_fee
  --
  -- Actualmente discount_amount y tip_amount no forman parte
  -- del checkout marketplace productivo.
  --
  -- Si en el futuro implementamos descuentos o propinas online,
  -- esta regla debe evolucionar al mismo tiempo que checkout.
  -- ==========================================================

  v_pricing_source :=
    lower(
      trim(
        coalesce(
          v_order.order_json->>'pricingSource',
          ''
        )
      )
    );


  if v_pricing_source in (
    'server-v82',
    'server-v86'
  ) then


    if coalesce(v_order.tip_amount, 0) <> 0 then
      raise exception
        'Online marketplace tip allocation is not implemented';
    end if;


    v_expected_gross :=
      round(
        greatest(
          coalesce(v_order.subtotal, 0)
          -
          coalesce(v_order.discount_amount, 0),
          0
        )
        +
        greatest(
          coalesce(v_order.final_delivery_fee, 0),
          0
        ),
        2
      );


    if v_expected_gross
       <> round(v_payment.amount, 2) then

      raise exception
        'Marketplace pricing components do not reconcile with payment';

    end if;

  end if;


  -- ==========================================================
  -- CONFIGURACION FINANCIERA
  -- ==========================================================

  select cfg.*
  into v_config

  from public.marketplace_finance_config cfg

  where cfg.id = true

  for share;


  if not found then
    raise exception
      'Marketplace finance configuration was not found';
  end if;


  -- ==========================================================
  -- DOMICILIARIO
  -- ==========================================================

  select da.courier_user_id
  into v_courier_id

  from public.delivery_assignments da

  where da.customer_order_id = v_order.id

    and da.status in (
      'accepted',
      'arrived_restaurant',
      'picked_up',
      'arrived_customer',
      'delivered'
    )

  order by da.updated_at desc

  limit 1;


  -- ==========================================================
  -- DISTRIBUCION
  -- ==========================================================

  v_restaurant_gross :=
    round(
      greatest(
        v_order.subtotal
        -
        v_order.discount_amount,
        0
      ),
      2
    );


  v_delivery_gross :=
    round(
      greatest(
        v_order.final_delivery_fee,
        0
      ),
      2
    );


  v_restaurant_fee :=
    round(
      v_restaurant_gross
      *
      v_config.restaurant_fee_bps
      /
      10000.0,
      2
    );


  v_courier_fee :=
    round(
      v_delivery_gross
      *
      v_config.courier_fee_bps
      /
      10000.0,
      2
    );


  v_restaurant_net :=
    greatest(
      v_restaurant_gross
      -
      v_restaurant_fee,
      0
    );


  v_courier_net :=
    greatest(
      v_delivery_gross
      -
      v_courier_fee,
      0
    );


  v_platform :=
    round(
      v_payment.amount
      -
      v_restaurant_net
      -
      v_courier_net,
      2
    );


  if v_platform < 0 then
    raise exception
      'Allocation does not reconcile';
  end if;


  -- Defensa adicional contra cualquier error de redondeo/logica.

  if round(
       v_restaurant_net
       +
       v_courier_net
       +
       v_platform,
       2
     )
     <>
     round(
       v_payment.amount,
       2
     ) then

    raise exception
      'Final marketplace allocation does not reconcile';

  end if;


  -- ==========================================================
  -- CREAR ALLOCATION
  -- ==========================================================

  insert into public.marketplace_payment_allocations (

    payment_transaction_id,

    customer_order_id,

    restaurant_user_id,

    courier_user_id,

    currency,

    gross_amount,

    restaurant_gross_amount,

    delivery_gross_amount,

    restaurant_fee_bps,

    courier_fee_bps,

    restaurant_fee_amount,

    courier_fee_amount,

    restaurant_net_amount,

    courier_net_amount,

    platform_amount,

    restaurant_release_eligible_at,

    courier_release_eligible_at,

    updated_at

  )
  values (

    v_payment.id,

    v_order.id,

    v_order.user_id,

    v_courier_id,

    upper(v_payment.currency),

    v_payment.amount,

    v_restaurant_gross,

    v_delivery_gross,

    v_config.restaurant_fee_bps,

    v_config.courier_fee_bps,

    v_restaurant_fee,

    v_courier_fee,

    v_restaurant_net,

    v_courier_net,

    v_platform,

    case
      when v_order.status = 'delivered'
        then now()
      else null
    end,

    null,

    now()

  )

  on conflict (payment_transaction_id)

  do update set

    courier_user_id =
      coalesce(
        excluded.courier_user_id,
        marketplace_payment_allocations.courier_user_id
      ),

    restaurant_release_eligible_at =
      coalesce(
        marketplace_payment_allocations.restaurant_release_eligible_at,
        excluded.restaurant_release_eligible_at
      ),

    updated_at = now()

  returning
    marketplace_payment_allocations.id
  into v_id;


  return v_id;

end;
$$;


-- ============================================================
-- 4. PERMISOS
-- ============================================================

revoke all
on function
  public.rc_ordera_calculate_marketplace_allocation(uuid)
from public, anon, authenticated;


grant execute
on function
  public.rc_ordera_calculate_marketplace_allocation(uuid)
to service_role;


-- ============================================================
-- 5. POSTCHECK
-- ============================================================

do $postcheck$
begin

  if has_function_privilege(
    'authenticated',
    'public.rc_ordera_calculate_marketplace_allocation(uuid)',
    'EXECUTE'
  ) then

    raise exception
      'SECURITY ERROR: authenticated puede ejecutar rc_ordera_calculate_marketplace_allocation';

  end if;


  if not has_function_privilege(
    'service_role',
    'public.rc_ordera_calculate_marketplace_allocation(uuid)',
    'EXECUTE'
  ) then

    raise exception
      'SECURITY ERROR: service_role no puede ejecutar rc_ordera_calculate_marketplace_allocation';

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
        'rc_ordera_lock_marketplace_pricing_after_checkout'

      and not t.tgisinternal

  ) then

    raise exception
      'SECURITY ERROR: financial lock trigger was not created';

  end if;

end;
$postcheck$;


commit;


notify pgrst, 'reload schema';
