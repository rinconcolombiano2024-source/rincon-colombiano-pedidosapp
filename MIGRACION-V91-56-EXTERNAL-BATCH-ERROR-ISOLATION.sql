
-- ============================================================
-- RC ORDERA V91-56
-- EXTERNAL BATCH AUDIT: ERROR ISOLATION
--
-- Replaces the implementation from V91-55.
-- Preserves function name, arguments and return type.
--
-- Each selected order receives an independent result.
-- Unexpected validation errors fail closed.
-- No sales, payments, imports or fiscal writes.
-- No cron, polling or new tables.
--
-- STAGING FIRST.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regprocedure(
    'public.rc_external_batch_audit(uuid,integer,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_55_REQUIRED';
  END IF;

  IF to_regprocedure(
    'public.rc_external_consolidated_audit(uuid,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_52_REQUIRED';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION
public.rc_external_batch_audit(
  p_restaurant_user_id uuid,
  p_limit integer DEFAULT 10,
  p_status text DEFAULT 'received'
)
RETURNS TABLE (
  inbox_id uuid,
  platform text,
  external_order_id text,
  processing_status text,
  received_at timestamptz,
  catalog_valid boolean,
  arithmetic_valid boolean,
  review_required boolean,
  verdict text,
  import_allowed boolean,
  fiscal_print_allowed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_order record;
  v_audit record;
BEGIN

  IF p_restaurant_user_id IS NULL THEN
    RAISE EXCEPTION 'RESTAURANT_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  IF p_limit IS NULL
     OR p_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'INVALID_BATCH_LIMIT'
      USING ERRCODE = '22023';
  END IF;

  IF p_status IS NULL
     OR p_status NOT IN (
       'received',
       'needs_review'
     ) THEN
    RAISE EXCEPTION 'INVALID_BATCH_STATUS'
      USING ERRCODE = '22023';
  END IF;

  -- Select only the bounded set of orders.
  FOR v_order IN
    SELECT
      i.id,
      i.platform AS source_platform,
      i.external_order_id AS source_order_id,
      i.processing_status AS source_status,
      i.received_at AS source_received_at
    FROM public.rc_external_delivery_inbox i
    WHERE i.restaurant_user_id =
      p_restaurant_user_id
      AND i.processing_status = p_status
    ORDER BY i.received_at, i.id
    LIMIT p_limit
  LOOP

    inbox_id := v_order.id;
    platform := v_order.source_platform;
    external_order_id := v_order.source_order_id;
    processing_status := v_order.source_status;
    received_at := v_order.source_received_at;

    -- Fail closed by default on every iteration.
    catalog_valid := false;
    arithmetic_valid := false;
    review_required := true;
    verdict := 'AUDIT_ERROR';
    import_allowed := false;
    fiscal_print_allowed := false;

    BEGIN

      SELECT
        a.catalog_valid,
        a.arithmetic_valid,
        a.review_required,
        a.verdict,
        a.import_allowed,
        a.fiscal_print_allowed
      INTO v_audit
      FROM public.rc_external_consolidated_audit(
        p_restaurant_user_id,
        v_order.id
      ) a;

      IF FOUND THEN
        catalog_valid :=
          COALESCE(v_audit.catalog_valid, false);

        arithmetic_valid :=
          COALESCE(v_audit.arithmetic_valid, false);

        review_required := true;

        verdict := 'AUDIT_ERROR';

        -- Only accept a known, internally
        -- consistent preliminary verdict.
        IF v_audit.catalog_valid IS TRUE
           AND v_audit.arithmetic_valid IS TRUE
           AND v_audit.review_required IS FALSE
           AND v_audit.verdict =
             'PRELIMINARY_CHECKS_PASSED'
        THEN
          review_required := false;
          verdict := 'PRELIMINARY_CHECKS_PASSED';

        ELSIF v_audit.review_required IS TRUE
          AND v_audit.verdict IN (
            'CATALOG_REVIEW_REQUIRED',
            'MONEY_REVIEW_REQUIRED'
          )
        THEN
          review_required := true;
          verdict := v_audit.verdict;

        END IF;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        -- An invalid order must not hide the
        -- diagnostic result of other orders.
        -- Do not expose raw DB error messages.
        catalog_valid := false;
        arithmetic_valid := false;
        review_required := true;
        verdict := 'AUDIT_ERROR';
    END;

    -- Never authorize imports or fiscal printing.
    import_allowed := false;
    fiscal_print_allowed := false;

    RETURN NEXT;

  END LOOP;

END;
$function$;

REVOKE ALL ON FUNCTION
public.rc_external_batch_audit(
  uuid,integer,text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_batch_audit(
  uuid,integer,text
)
TO service_role;

COMMIT;
