-- RC ORDERA — Safe additive financial close gate. No historical rows updated/deleted.
-- Blocks even direct calls to close_current_restaurant_period: all writers go through this trigger.
-- Review/execute in a controlled DB release; monitor report aggregates before production rollout.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.orders') IS NULL
     OR to_regclass('public.customer_orders') IS NULL
     OR to_regclass('public.order_station_tasks') IS NULL
     OR to_regclass('public.restaurant_period_closures') IS NULL
     OR to_regclass('public.restaurant_profiles') IS NULL THEN
    RAISE EXCEPTION 'RC_ORDERA_CLOSE_REQUIRED_TABLE_MISSING';
  END IF;
  IF to_regprocedure('public.close_current_restaurant_period(text,date)') IS NULL THEN
    RAISE EXCEPTION 'RC_ORDERA_CLOSE_RPC_MISSING';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.rc_ordera_check_period_close_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $guard$
DECLARE
  v_timezone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_orders bigint;
  v_gross numeric;
  v_payment_count numeric;
  v_payment_total numeric;
BEGIN
  IF NEW.restaurant_user_id IS NULL OR NEW.period_start IS NULL OR NEW.period_end IS NULL
     OR NEW.period_end < NEW.period_start THEN
    RAISE EXCEPTION 'RC_ORDERA_CLOSE_INVALID_PERIOD';
  END IF;
  SELECT coalesce(nullif(trim(rp.timezone), ''),
           CASE upper(coalesce(rp.country_code, ''))
             WHEN 'PL' THEN 'Europe/Warsaw' WHEN 'CO' THEN 'America/Bogota'
             ELSE 'UTC' END)
  INTO v_timezone
  FROM public.restaurant_profiles rp
  WHERE rp.user_id = NEW.restaurant_user_id AND rp.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'RC_ORDERA_CLOSE_RESTAURANT_MISSING'; END IF;
  v_start_at := NEW.period_start::timestamp AT TIME ZONE v_timezone;
  v_end_at := (NEW.period_end + 1)::timestamp AT TIME ZONE v_timezone;

  -- POS statuses are authoritative for paid tickets. A saved ticket is not a finished ticket.
  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = NEW.restaurant_user_id
      AND o.business_date BETWEEN NEW.period_start AND NEW.period_end
      AND lower(trim(coalesce(nullif(o.canonical_status,''),nullif(o.status,''),
        o.order_json->>'canonicalStatus',o.order_json->>'status','')))
          NOT IN ('completed','delivered','cancelled','rejected')
  ) THEN RAISE EXCEPTION 'RC_ORDERA_CLOSE_ORDERS_UNFINISHED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = NEW.restaurant_user_id
      AND o.business_date BETWEEN NEW.period_start AND NEW.period_end
      AND lower(trim(coalesce(nullif(o.canonical_status,''),nullif(o.status,''),
        o.order_json->>'canonicalStatus',o.order_json->>'status','')))
          NOT IN ('cancelled','rejected')
      AND lower(trim(coalesce(nullif(o.order_json->>'paymentStatus',''),
                              nullif(o.order_json->>'payment_status',''),''))) <> 'paid'
  ) THEN RAISE EXCEPTION 'RC_ORDERA_CLOSE_PAYMENT_NOT_CONFIRMED'; END IF;

  -- "Pago en caja" is only an intent to collect, not an actual cash/card/transfer tender.
  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = NEW.restaurant_user_id
      AND o.business_date BETWEEN NEW.period_start AND NEW.period_end
      AND lower(trim(coalesce(nullif(o.canonical_status,''),nullif(o.status,''),
        o.order_json->>'canonicalStatus',o.order_json->>'status','')))
          NOT IN ('cancelled','rejected')
      AND lower(trim(coalesce(nullif(o.order_json->>'paymentMethod',''),
                              nullif(o.order_json->>'payment_method',''),'')))
          NOT IN ('efectivo','cash','gotówka','gotowka','datafono','datáfono',
                  'card','tarjeta','terminal','card_terminal','transferencia',
                  'bank_transfer','online','stripe','sumup','blik')
  ) THEN RAISE EXCEPTION 'RC_ORDERA_CLOSE_PAYMENT_METHOD_REQUIRED'; END IF;

  -- Customer/waiter kitchen states must be terminal even if a POS mirror says completed.
  -- Linked orders use their POS business_date; unlinked orders use restaurant-local time.
  IF EXISTS (
    SELECT 1 FROM public.customer_orders c
    LEFT JOIN public.orders o ON o.id = c.restaurant_order_id
      AND o.user_id = NEW.restaurant_user_id
    WHERE c.user_id = NEW.restaurant_user_id
      AND ((o.id IS NOT NULL AND o.business_date BETWEEN NEW.period_start AND NEW.period_end)
        OR (o.id IS NULL AND c.created_at >= v_start_at AND c.created_at < v_end_at))
      AND lower(trim(coalesce(nullif(c.canonical_status,''),nullif(c.status,''),'')))
          NOT IN ('cancelled','rejected')
      AND (
        lower(trim(coalesce(nullif(c.canonical_status,''),nullif(c.status,''),'')))
          NOT IN ('completed','delivered')
        OR lower(trim(coalesce(c.station_status,''))) <> 'completed'
      )
  ) THEN RAISE EXCEPTION 'RC_ORDERA_CLOSE_CLIENT_ORDER_IN_PROGRESS'; END IF;

  -- Never ignore physical preparation that remains marked "preparing".
  IF EXISTS (
    SELECT 1 FROM public.order_station_tasks t
    JOIN public.customer_orders c ON c.id = t.customer_order_id
    LEFT JOIN public.orders o ON o.id = c.restaurant_order_id
      AND o.user_id = NEW.restaurant_user_id
    WHERE t.restaurant_user_id = NEW.restaurant_user_id
      AND c.user_id = NEW.restaurant_user_id
      AND ((o.id IS NOT NULL AND o.business_date BETWEEN NEW.period_start AND NEW.period_end)
        OR (o.id IS NULL AND c.created_at >= v_start_at AND c.created_at < v_end_at))
      AND lower(trim(coalesce(c.canonical_status,c.status,''))) NOT IN ('cancelled','rejected')
      AND t.status = 'preparing'
  ) THEN RAISE EXCEPTION 'RC_ORDERA_CLOSE_STATION_IN_PREPARATION'; END IF;

  -- Unlinked customer checkout must never be silently left unpaid.
  IF EXISTS (
    SELECT 1 FROM public.customer_orders c
    LEFT JOIN public.orders o ON o.id = c.restaurant_order_id
      AND o.user_id = NEW.restaurant_user_id
    WHERE c.user_id = NEW.restaurant_user_id AND o.id IS NULL
      AND c.created_at >= v_start_at AND c.created_at < v_end_at
      AND lower(trim(coalesce(c.canonical_status,c.status,''))) NOT IN ('cancelled','rejected')
      AND (lower(trim(coalesce(c.payment_status,''))) <> 'paid'
           OR lower(trim(coalesce(c.payment_method,''))) NOT IN
            ('efectivo','cash','gotówka','gotowka','datafono','datáfono',
             'card','tarjeta','terminal','card_terminal','transferencia',
             'bank_transfer','online','stripe','sumup','blik'))
  ) THEN RAISE EXCEPTION 'RC_ORDERA_CLOSE_UNLINKED_CUSTOMER_UNPAID'; END IF;

  -- A plausible-looking report is not enough: reconcile to the actual POS rows.
  IF NEW.report_snapshot IS NULL OR jsonb_typeof(NEW.report_snapshot) <> 'object'
     OR jsonb_typeof(NEW.report_snapshot->'order_count') <> 'number'
     OR jsonb_typeof(NEW.report_snapshot->'sales_total') <> 'number'
     OR jsonb_typeof(NEW.report_snapshot->'payment_methods') <> 'array' THEN
    RAISE EXCEPTION 'RC_ORDERA_CLOSE_REPORT_INCOMPLETE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.report_snapshot->'payment_methods') pm
    WHERE jsonb_typeof(pm) <> 'object'
      OR nullif(trim(coalesce(pm->>'payment_method','')),'') IS NULL
      OR lower(trim(coalesce(pm->>'payment_method',''))) NOT IN
        ('efectivo','cash','gotówka','gotowka','datafono','datáfono',
         'card','tarjeta','terminal','card_terminal','transferencia',
         'bank_transfer','online','stripe','sumup','blik')
      OR coalesce(pm->>'orders','') !~ '^[0-9]+$'
      OR coalesce(pm->>'total','') !~ '^-?[0-9]+([.][0-9]+)?$'
  ) THEN RAISE EXCEPTION 'RC_ORDERA_CLOSE_REPORT_INVALID_GROUP'; END IF;

  SELECT count(*)::bigint, coalesce(round(sum(o.total),2),0)
    INTO v_orders,v_gross FROM public.orders o
    WHERE o.user_id = NEW.restaurant_user_id
      AND o.business_date BETWEEN NEW.period_start AND NEW.period_end
      AND lower(trim(coalesce(nullif(o.canonical_status,''),nullif(o.status,''),
        o.order_json->>'canonicalStatus',o.order_json->>'status','')))
          NOT IN ('cancelled','rejected');

  SELECT coalesce(sum((pm->>'orders')::numeric),0),
         coalesce(sum((pm->>'total')::numeric),0)
    INTO v_payment_count,v_payment_total
  FROM jsonb_array_elements(NEW.report_snapshot->'payment_methods') pm;
  IF (NEW.report_snapshot->>'order_count')::numeric <> v_orders
     OR v_payment_count <> v_orders
     OR abs((NEW.report_snapshot->>'sales_total')::numeric - v_gross) > 0.01
     OR abs(v_payment_total - v_gross) > 0.01 THEN
    RAISE EXCEPTION 'RC_ORDERA_CLOSE_REPORT_NOT_RECONCILED';
  END IF;
  RETURN NEW;
END;
$guard$;

-- Reentrant and reversible: only adds a new guard to the existing closures table.
CREATE OR REPLACE TRIGGER rc_ordera_period_close_financial_guard
BEFORE INSERT OR UPDATE OF report_snapshot ON public.restaurant_period_closures
FOR EACH ROW EXECUTE FUNCTION public.rc_ordera_check_period_close_before_write();

-- RPC executes as owner; do not expose the helper trigger function via PostgREST.
REVOKE ALL ON FUNCTION public.rc_ordera_check_period_close_before_write()
  FROM PUBLIC, anon, authenticated;
COMMIT;

-- Rollback if ever required (does not touch any closure/order data):
-- DROP TRIGGER IF EXISTS rc_ordera_period_close_financial_guard ON public.restaurant_period_closures;
-- DROP FUNCTION IF EXISTS public.rc_ordera_check_period_close_before_write();
