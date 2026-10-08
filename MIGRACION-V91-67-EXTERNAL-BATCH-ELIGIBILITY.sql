
-- ============================================================
-- RC ORDERA V91-67
-- BATCH AUDIT ELIGIBILITY COMPATIBILITY
--
-- Corrects V91-56 compatibility with V91-66.
-- Does not change the function signature.
-- Does not alter orders, payments, kitchen or POSNET.
-- No triggers, cron or polling.
--
-- INSTALL AND TEST FIRST IN STAGING.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regprocedure(
    'public.rc_external_batch_audit(uuid,integer,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_56_REQUIRED';
  END IF;

  IF to_regprocedure(
    'public.rc_external_consolidated_audit(uuid,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_66_REQUIRED';
  END IF;

  IF position(
    'RESTAURANT_NOT_ELIGIBLE' IN
    pg_get_functiondef(
      to_regprocedure(
        'public.rc_external_consolidated_audit(uuid,uuid)'
      )
    )
  ) = 0 THEN
    RAISE EXCEPTION 'V91_66_NOT_INSTALLED';
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
    ORDER BY
      i.received_at ASC,
      i.id ASC
    LIMIT p_limit
  LOOP

    inbox_id := v_order.id;
    platform := v_order.source_platform;
    external_order_id := v_order.source_order_id;
    processing_status := v_order.source_status;
    received_at := v_order.source_received_at;

    -- Fail closed for every individual order.
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
        a.verdict
      INTO v_audit
      FROM public.rc_external_consolidated_audit(
        p_restaurant_user_id,
        v_order.id
      ) AS a;

      IF FOUND THEN

        catalog_valid :=
          COALESCE(v_audit.catalog_valid, false);

        arithmetic_valid :=
          COALESCE(v_audit.arithmetic_valid, false);

        IF v_audit.verdict =
             'RESTAURANT_NOT_ELIGIBLE'
           AND v_audit.catalog_valid IS FALSE
           AND v_audit.review_required IS TRUE
        THEN

          review_required := true;
          verdict := 'RESTAURANT_NOT_ELIGIBLE';

        ELSIF v_audit.verdict =
                'PRELIMINARY_CHECKS_PASSED'
          AND v_audit.catalog_valid IS TRUE
          AND v_audit.arithmetic_valid IS TRUE
          AND v_audit.review_required IS FALSE
        THEN

          review_required := false;
          verdict := 'PRELIMINARY_CHECKS_PASSED';

        ELSIF v_audit.verdict =
                'CATALOG_REVIEW_REQUIRED'
          AND v_audit.catalog_valid IS FALSE
          AND v_audit.review_required IS TRUE
        THEN

          review_required := true;
          verdict := 'CATALOG_REVIEW_REQUIRED';

        ELSIF v_audit.verdict =
                'MONEY_REVIEW_REQUIRED'
          AND v_audit.catalog_valid IS TRUE
          AND v_audit.arithmetic_valid IS FALSE
          AND v_audit.review_required IS TRUE
        THEN

          review_required := true;
          verdict := 'MONEY_REVIEW_REQUIRED';

        ELSE

          -- Reject inconsistent or unknown verdicts.
          catalog_valid := false;
          arithmetic_valid := false;
          review_required := true;
          verdict := 'AUDIT_ERROR';

        END IF;

      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        -- Isolate ordinary validation errors.
        -- No raw database error exposed.
        catalog_valid := false;
        arithmetic_valid := false;
        review_required := true;
        verdict := 'AUDIT_ERROR';
    END;

    -- These permissions are NEVER granted
    -- by this diagnostic function.
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
