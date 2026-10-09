
-- ============================================================
-- RC ORDERA V91-70
-- EXTERNAL BATCH REVIEW COMPATIBILITY
--
-- Requires V91-69 applied to the same database.
--
-- Fixes the contract mismatch:
-- V91-69 returns review_required = TRUE
-- even when preliminary checks pass.
--
-- PRESERVES:
-- - Function name and arguments
-- - Output columns and their order
-- - Existing verdict names
-- - Service-role access controls
-- - Batch size limits
-- - Tenant isolation
-- - Fail-closed defaults
--
-- NO:
-- - Fiscal printing
-- - Order imports
-- - Payments
-- - Table changes
-- - Triggers
-- - Cron jobs
-- - Polling
--
-- STAGING FIRST. NOT YET VERIFIED ON LIVE DB.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ============================================================
-- 1. PREFLIGHT
-- ============================================================

DO $preflight$
DECLARE
  v_audit_function regprocedure;
BEGIN

  IF to_regclass(
    'public.rc_external_delivery_inbox'
  ) IS NULL THEN
    RAISE EXCEPTION
      'V91_70_EXTERNAL_INBOX_MISSING';
  END IF;

  IF to_regprocedure(
    'public.rc_external_batch_audit(uuid,integer,text)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'V91_70_BATCH_AUDIT_MISSING';
  END IF;

  v_audit_function := to_regprocedure(
    'public.rc_external_consolidated_audit(uuid,uuid)'
  );

  IF v_audit_function IS NULL THEN
    RAISE EXCEPTION
      'V91_70_CONSOLIDATED_AUDIT_MISSING';
  END IF;

  -- Check that the reviewed V91-69 body is present.
  IF position(
    'SECURITY FIX V91-69' IN
    pg_get_functiondef(v_audit_function)
  ) = 0 THEN
    RAISE EXCEPTION
      'V91_70_REQUIRES_V91_69';
  END IF;

END;
$preflight$;

-- ============================================================
-- 2. COMPATIBLE BATCH AUDIT
-- ============================================================

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

  -- Bounded query. No unbounded scans
  -- or continuous polling.
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
    external_order_id :=
      v_order.source_order_id;
    processing_status :=
      v_order.source_status;
    received_at :=
      v_order.source_received_at;

    -- Every row starts in a secure state.
    catalog_valid := false;
    arithmetic_valid := false;
    review_required := true;
    verdict := 'AUDIT_ERROR';
    import_allowed := false;
    fiscal_print_allowed := false;

    BEGIN

      -- Reuse existing consolidated validation.
      SELECT
        a.inbox_id,
        a.platform,
        a.processing_status,
        a.catalog_valid,
        a.arithmetic_valid,
        a.review_required,
        a.import_allowed,
        a.fiscal_print_allowed,
        a.verdict
      INTO v_audit
      FROM public.rc_external_consolidated_audit(
        p_restaurant_user_id,
        v_order.id
      ) AS a;

      IF FOUND THEN

        -- Reject identity mismatches and any
        -- unexpected authorization result.
        IF
          v_audit.inbox_id IS DISTINCT FROM
            v_order.id
          OR v_audit.platform IS DISTINCT FROM
            v_order.source_platform
          OR v_audit.processing_status IS DISTINCT FROM
            v_order.source_status
          OR v_audit.review_required IS DISTINCT FROM
            true
          OR v_audit.import_allowed IS DISTINCT FROM
            false
          OR v_audit.fiscal_print_allowed IS DISTINCT FROM
            false
        THEN

          catalog_valid := false;
          arithmetic_valid := false;
          review_required := true;
          verdict := 'AUDIT_ERROR';

        ELSE

          catalog_valid :=
            COALESCE(v_audit.catalog_valid, false);

          arithmetic_valid :=
            COALESCE(v_audit.arithmetic_valid, false);

          IF v_audit.verdict =
               'RESTAURANT_NOT_ELIGIBLE'
             AND v_audit.catalog_valid IS FALSE
             AND v_audit.arithmetic_valid IS FALSE
          THEN

            review_required := true;
            verdict := 'RESTAURANT_NOT_ELIGIBLE';

          ELSIF v_audit.verdict =
                  'PRELIMINARY_CHECKS_PASSED'
            AND v_audit.catalog_valid IS TRUE
            AND v_audit.arithmetic_valid IS TRUE
          THEN

            -- V91-70 FIX:
            -- Recognize preliminary success while
            -- keeping manual review mandatory.
            review_required := true;
            verdict := 'PRELIMINARY_CHECKS_PASSED';

          ELSIF v_audit.verdict =
                  'CATALOG_REVIEW_REQUIRED'
            AND v_audit.catalog_valid IS FALSE
          THEN

            review_required := true;
            verdict := 'CATALOG_REVIEW_REQUIRED';

          ELSIF v_audit.verdict =
                  'MONEY_REVIEW_REQUIRED'
            AND v_audit.catalog_valid IS TRUE
            AND v_audit.arithmetic_valid IS FALSE
          THEN

            review_required := true;
            verdict := 'MONEY_REVIEW_REQUIRED';

          ELSE

            -- Unknown or inconsistent verdicts
            -- are rejected conservatively.
            catalog_valid := false;
            arithmetic_valid := false;
            review_required := true;
            verdict := 'AUDIT_ERROR';

          END IF;

        END IF;

      END IF;

    EXCEPTION
      WHEN OTHERS THEN

        -- Preserve per-order error isolation.
        -- Do not expose raw DB errors.
        catalog_valid := false;
        arithmetic_valid := false;
        review_required := true;
        verdict := 'AUDIT_ERROR';

    END;

    -- Absolute authorization boundaries.
    import_allowed := false;
    fiscal_print_allowed := false;

    RETURN NEXT;

  END LOOP;

END;
$function$;

-- ============================================================
-- 3. FUNCTION ACCESS CONTROL
-- ============================================================

REVOKE ALL ON FUNCTION
public.rc_external_batch_audit(
  uuid,
  integer,
  text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_batch_audit(
  uuid,
  integer,
  text
)
TO service_role;

COMMIT;

-- ============================================================
-- RC ORDERA V91-70 END
-- ============================================================
