
-- ============================================================
-- RC ORDERA V91-66
-- RESTAURANT ELIGIBILITY IN CONSOLIDATED AUDIT
--
-- Replaces V91-52 implementation.
-- Preserves signature and output columns.
-- Rejects deleted, inactive and missing profiles.
--
-- Does not create/import orders.
-- Does not modify sales, kitchen, payments or POSNET.
-- STAGING FIRST.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regclass('public.restaurant_profiles') IS NULL
     OR to_regprocedure(
       'public.rc_external_consolidated_audit(uuid,uuid)'
     ) IS NULL
  THEN
    RAISE EXCEPTION 'V91_52_OR_PROFILES_REQUIRED';
  END IF;
END;
$preflight$;

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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$

WITH eligibility AS MATERIALIZED (
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_profiles rp
    WHERE rp.user_id = p_restaurant_user_id
      AND rp.active IS TRUE
      AND rp.deleted_at IS NULL
  ) AS eligible
),
catalog AS MATERIALIZED (
  SELECT *
  FROM public.rc_external_order_readiness(
    p_restaurant_user_id,
    p_inbox_id
  )
),
money AS MATERIALIZED (
  SELECT *
  FROM public.rc_external_validate_money(
    p_restaurant_user_id,
    p_inbox_id
  )
),
checks AS (
  SELECT
    c.*,
    m.money_valid,
    m.verdict AS money_verdict,
    m.details AS money_details,
    m.expected_total_grosz,
    m.declared_total_grosz,
    m.difference_grosz,
    e.eligible,

    (
      e.eligible
      AND c.catalog_ready IS TRUE
      AND c.verdict = 'CATALOG_CHECK_PASSED'
    ) AS catalog_ok,

    (
      m.money_valid IS TRUE
      AND m.verdict = 'ARITHMETIC_MATCH'
    ) AS arithmetic_ok

  FROM catalog c
  JOIN money m
    ON m.inbox_id = c.inbox_id
  CROSS JOIN eligibility e
)
SELECT
  c.inbox_id,
  c.platform,
  c.processing_status,

  c.catalog_ok AS catalog_valid,
  c.arithmetic_ok AS arithmetic_valid,

  NOT (
    c.catalog_ok
    AND c.arithmetic_ok
  ) AS review_required,

  false AS import_allowed,
  false AS fiscal_print_allowed,

  CASE
    WHEN NOT c.eligible
      THEN 'RESTAURANT_NOT_ELIGIBLE'

    WHEN NOT c.catalog_ok
      THEN 'CATALOG_REVIEW_REQUIRED'

    WHEN NOT c.arithmetic_ok
      THEN 'MONEY_REVIEW_REQUIRED'

    ELSE 'PRELIMINARY_CHECKS_PASSED'
  END AS verdict,

  jsonb_build_object(
    'restaurantEligible', c.eligible,
    'catalog', c.details,
    'money', c.money_details,
    'lineCount', c.line_count,
    'totalQuantity', c.total_quantity,
    'expectedTotalGrosz', c.expected_total_grosz,
    'declaredTotalGrosz', c.declared_total_grosz,
    'differenceGrosz', c.difference_grosz,
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
  ) AS details

FROM checks c;

$function$;

REVOKE ALL ON FUNCTION
public.rc_external_consolidated_audit(uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_consolidated_audit(uuid,uuid)
TO service_role;

COMMIT;
