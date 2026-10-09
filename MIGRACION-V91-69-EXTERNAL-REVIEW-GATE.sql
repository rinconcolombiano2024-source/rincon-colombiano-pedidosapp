
-- ============================================================
-- RC ORDERA V91-69
-- EXTERNAL REVIEW GATE — FAIL CLOSED
--
-- Dependency: V91-68.
--
-- Fix:
-- Preliminary catalog and monetary checks must NEVER
-- imply that a third-party order is fully approved.
--
-- The following remain explicitly disabled:
-- - Automatic external order import
-- - Automatic fiscal receipt issuance
--
-- COMPATIBILITY:
-- - Preserves existing RPC name and signature
-- - Preserves existing output columns
-- - Preserves existing verdict values
-- - Preserves existing JSON response keys
-- - No table alterations
-- - No order, payment or accounting writes
-- - No cron, triggers, timers or polling
--
-- DEPLOY TO STAGING FIRST.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ============================================================
-- 1. PREFLIGHT
-- ============================================================

DO $preflight$
BEGIN

  IF to_regclass(
    'public.restaurant_profiles'
  ) IS NULL
  OR to_regclass(
    'public.rc_external_delivery_inbox'
  ) IS NULL
  OR to_regprocedure(
    'public.rc_external_order_readiness(uuid,uuid)'
  ) IS NULL
  OR to_regprocedure(
    'public.rc_external_validate_money(uuid,uuid)'
  ) IS NULL
  OR to_regprocedure(
    'public.rc_external_consolidated_audit(uuid,uuid)'
  ) IS NULL
  THEN
    RAISE EXCEPTION
      'V91_69_DEPENDENCY_MISSING';
  END IF;

END;
$preflight$;

-- ============================================================
-- 2. CONSOLIDATED AUDIT — REVIEW ALWAYS REQUIRED
-- ============================================================

CREATE OR REPLACE FUNCTION
public.rc_external_consolidated_audit(
  p_restaurant_user_id uuid,
  p_inbox_id uuid
)
RETURNS TABLE (
  inbox_id uuid,
  platform text,
  processing_status text,
  catalog_valid boolean,
  arithmetic_valid boolean,
  review_required boolean,
  import_allowed boolean,
  fiscal_print_allowed boolean,
  verdict text,
  details jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_inbox record;
  v_eligible boolean;
  v_catalog record;
  v_money record;
  v_catalog_ok boolean;
  v_money_ok boolean;
BEGIN

  IF p_restaurant_user_id IS NULL
     OR p_inbox_id IS NULL THEN
    RAISE EXCEPTION 'IDENTIFIERS_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  -- Check tenant ownership.
  SELECT
    i.id,
    i.platform,
    i.processing_status
  INTO v_inbox
  FROM public.rc_external_delivery_inbox i
  WHERE i.id = p_inbox_id
    AND i.restaurant_user_id =
      p_restaurant_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  -- Check restaurant eligibility first.
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_profiles rp
    WHERE rp.user_id = p_restaurant_user_id
      AND rp.active IS TRUE
      AND rp.deleted_at IS NULL
  )
  INTO v_eligible;

  inbox_id := v_inbox.id;
  platform := v_inbox.platform;
  processing_status := v_inbox.processing_status;

  -- CRITICAL SECURITY DEFAULTS.
  --
  -- Preliminary validation never grants
  -- import or fiscal authorization.
  import_allowed := false;
  fiscal_print_allowed := false;
  review_required := true;

  -- Ineligible restaurants stop early.
  IF v_eligible IS NOT TRUE THEN

    catalog_valid := false;
    arithmetic_valid := false;

    verdict := 'RESTAURANT_NOT_ELIGIBLE';

    details := jsonb_build_object(
      'restaurantEligible', false,
      'catalogValidation', 'NOT_RUN',
      'moneyValidation', 'NOT_RUN',
      'automaticImportAllowed', false,
      'fiscalPrintAllowed', false
    );

    RETURN NEXT;
    RETURN;
  END IF;

  -- Reuse current catalog validation.
  SELECT *
  INTO STRICT v_catalog
  FROM public.rc_external_order_readiness(
    p_restaurant_user_id,
    p_inbox_id
  );

  -- Reuse current monetary validation.
  SELECT *
  INTO STRICT v_money
  FROM public.rc_external_validate_money(
    p_restaurant_user_id,
    p_inbox_id
  );

  v_catalog_ok :=
    v_catalog.catalog_ready IS TRUE
    AND v_catalog.verdict =
      'CATALOG_CHECK_PASSED';

  v_money_ok :=
    v_money.money_valid IS TRUE
    AND v_money.verdict =
      'ARITHMETIC_MATCH';

  catalog_valid := v_catalog_ok;
  arithmetic_valid := v_money_ok;

  -- SECURITY FIX V91-69:
  --
  -- Passing preliminary checks does not
  -- finish order review.
  --
  -- Pending:
  -- * Payment confirmation
  -- * Provider settlement
  -- * Modifiers
  -- * VAT allocation
  -- * Authorized transactional import
  -- * Fiscal idempotency
  --
  -- review_required remains TRUE.

  review_required := true;

  -- Preserve legacy verdict values.
  verdict := CASE
    WHEN NOT v_catalog_ok
      THEN 'CATALOG_REVIEW_REQUIRED'
    WHEN NOT v_money_ok
      THEN 'MONEY_REVIEW_REQUIRED'
    ELSE 'PRELIMINARY_CHECKS_PASSED'
  END;

  -- Preserve existing details structure.
  details := jsonb_build_object(
    'restaurantEligible', true,
    'catalog', v_catalog.details,
    'money', v_money.details,
    'lineCount', v_catalog.line_count,
    'totalQuantity', v_catalog.total_quantity,
    'expectedTotalGrosz',
      v_money.expected_total_grosz,
    'declaredTotalGrosz',
      v_money.declared_total_grosz,
    'differenceGrosz',
      v_money.difference_grosz,
    'remainingChecks', jsonb_build_array(
      'PAYMENT_CONFIRMATION',
      'PLATFORM_SETTLEMENT',
      'MODIFIERS',
      'TAX_ALLOCATION',
      'AUTHORIZED_IMPORT',
      'FISCAL_IDEMPOTENCY'
    ),
    'automaticImportAllowed', false,
    'fiscalPrintAllowed', false
  );

  RETURN NEXT;
END;
$function$;

-- ============================================================
-- 3. MAINTAIN RPC ACCESS CONTROL
-- ============================================================

REVOKE ALL ON FUNCTION
public.rc_external_consolidated_audit(
  uuid,
  uuid
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_consolidated_audit(
  uuid,
  uuid
)
TO service_role;

COMMIT;

-- ============================================================
-- END — RC ORDERA V91-69
-- ============================================================
