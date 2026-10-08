
-- ============================================================
-- RC ORDERA V91-52
-- CONSOLIDATED EXTERNAL ORDER AUDIT
--
-- Depends on V91-50 and V91-51.
-- Combines catalog and arithmetic validation.
--
-- READ ONLY. SERVICE ROLE ONLY.
-- Does not authorize imports, fiscal printing,
-- kitchen dispatch, payments or accounting.
-- No cron, triggers or polling.
-- Test in staging before production.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regprocedure(
    'public.rc_external_order_readiness(uuid,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_50_REQUIRED';
  END IF;

  IF to_regprocedure(
    'public.rc_external_validate_money(uuid,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_51_REQUIRED';
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

WITH catalog AS MATERIALIZED (
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
)
SELECT
  c.inbox_id,
  c.platform,
  c.processing_status,

  (
    c.catalog_ready IS TRUE
    AND c.verdict = 'CATALOG_CHECK_PASSED'
  ) AS catalog_valid,

  (
    m.money_valid IS TRUE
    AND m.verdict = 'ARITHMETIC_MATCH'
  ) AS arithmetic_valid,

  NOT (
    c.catalog_ready IS TRUE
    AND c.verdict = 'CATALOG_CHECK_PASSED'
    AND m.money_valid IS TRUE
    AND m.verdict = 'ARITHMETIC_MATCH'
  ) AS review_required,

  -- Deliberately disabled:
  -- No financial settlement, tax or modifier
  -- validation has been implemented yet.
  false AS import_allowed,
  false AS fiscal_print_allowed,

  CASE
    WHEN c.catalog_ready IS NOT TRUE
      OR c.verdict <> 'CATALOG_CHECK_PASSED'
    THEN 'CATALOG_REVIEW_REQUIRED'

    WHEN m.money_valid IS NOT TRUE
      OR m.verdict <> 'ARITHMETIC_MATCH'
    THEN 'MONEY_REVIEW_REQUIRED'

    ELSE 'PRELIMINARY_CHECKS_PASSED'
  END AS verdict,

  jsonb_build_object(
    'catalog', c.details,
    'money', m.details,
    'lineCount', c.line_count,
    'totalQuantity', c.total_quantity,
    'expectedTotalGrosz', m.expected_total_grosz,
    'declaredTotalGrosz', m.declared_total_grosz,
    'differenceGrosz', m.difference_grosz,
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

FROM catalog c
INNER JOIN money m
  ON m.inbox_id = c.inbox_id;

$function$;

REVOKE ALL ON FUNCTION
public.rc_external_consolidated_audit(uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_consolidated_audit(uuid,uuid)
TO service_role;

COMMIT;

