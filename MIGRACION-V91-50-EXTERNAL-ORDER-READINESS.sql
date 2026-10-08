
-- ==========================================================
-- RC ORDERA V91-50
-- EXTERNAL ORDER READINESS AUDIT
--
-- Depends on V91-49.
-- One consolidated verdict per external order.
--
-- READ ONLY:
-- No order creation, updates, fiscal operations,
-- kitchen dispatch, payments, cron or polling.
--
-- STAGING FIRST.
-- ==========================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regclass(
    'public.rc_external_delivery_inbox'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_36_REQUIRED';
  END IF;

  IF to_regprocedure(
    'public.rc_external_check_order_items(uuid,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_49_REQUIRED';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION
public.rc_external_order_readiness(
  p_restaurant_user_id uuid,
  p_inbox_id uuid
)
RETURNS TABLE (
  inbox_id uuid,
  platform text,
  processing_status text,
  line_count bigint,
  total_quantity bigint,
  valid_lines bigint,
  invalid_lines bigint,
  catalog_ready boolean,
  import_ready boolean,
  verdict text,
  details jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_order public.rc_external_delivery_inbox%ROWTYPE;
  v_line_count bigint := 0;
  v_total_quantity bigint := 0;
  v_valid_lines bigint := 0;
  v_invalid_lines bigint := 0;
  v_duplicate_ids bigint := 0;
  v_items jsonb;
  v_all_lines jsonb := '[]'::jsonb;
  v_reasons jsonb := '[]'::jsonb;
  v_catalog_ready boolean := false;
BEGIN

  IF p_restaurant_user_id IS NULL
     OR p_inbox_id IS NULL THEN
    RAISE EXCEPTION 'IDENTIFIERS_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  SELECT i.*
  INTO v_order
  FROM public.rc_external_delivery_inbox i
  WHERE i.id = p_inbox_id
    AND i.restaurant_user_id = p_restaurant_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  -- Reuse V91-49. No independent reinterpretation
  -- of mapping validity or availability.
  SELECT
    COUNT(*),
    COALESCE(SUM(c.quantity), 0),
    COUNT(*) FILTER (
      WHERE c.validation_status = 'CATALOG_VALID'
    ),
    COUNT(*) FILTER (
      WHERE c.validation_status IS DISTINCT FROM
        'CATALOG_VALID'
    ),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'line', c.line_number,
          'externalProductId', c.external_product_id,
          'internalProductId', c.internal_product_id,
          'quantity', c.quantity,
          'status', c.validation_status
        )
        ORDER BY c.line_number
      ),
      '[]'::jsonb
    )
  INTO
    v_line_count,
    v_total_quantity,
    v_valid_lines,
    v_invalid_lines,
    v_all_lines
  FROM public.rc_external_check_order_items(
    p_restaurant_user_id,
    p_inbox_id
  ) c;

  v_items := v_order.payload -> 'items';

  -- Detect repeated external product IDs.
  -- This is conservative: duplicated lines
  -- must be reviewed before import.
  IF jsonb_typeof(v_items) = 'array' THEN
    SELECT COUNT(*)
    INTO v_duplicate_ids
    FROM (
      SELECT item.value ->> 'productId' AS product_id
      FROM jsonb_array_elements(v_items) item(value)
      WHERE jsonb_typeof(item.value) = 'object'
      GROUP BY item.value ->> 'productId'
      HAVING COUNT(*) > 1
    ) duplicated;
  END IF;

  IF v_invalid_lines > 0 THEN
    v_reasons := v_reasons ||
      '["INVALID_OR_UNMAPPED_ITEMS"]'::jsonb;
  END IF;

  IF v_line_count < 1 OR v_line_count > 60 THEN
    v_reasons := v_reasons ||
      '["INVALID_LINE_COUNT"]'::jsonb;
  END IF;

  -- Defensive order-level quantity limit.
  IF v_total_quantity < 1
     OR v_total_quantity > 100 THEN
    v_reasons := v_reasons ||
      '["INVALID_TOTAL_QUANTITY"]'::jsonb;
  END IF;

  IF v_duplicate_ids > 0 THEN
    v_reasons := v_reasons ||
      '["DUPLICATE_EXTERNAL_PRODUCTS"]'::jsonb;
  END IF;

  IF v_order.processing_status <> 'received' THEN
    v_reasons := v_reasons ||
      '["ORDER_NOT_PENDING"]'::jsonb;
  END IF;

  IF v_order.internal_order_id IS NOT NULL THEN
    v_reasons := v_reasons ||
      '["ALREADY_LINKED"]'::jsonb;
  END IF;

  IF v_order.currency <> 'PLN' THEN
    v_reasons := v_reasons ||
      '["UNSUPPORTED_CURRENCY"]'::jsonb;
  END IF;

  IF v_order.total_grosz IS NULL THEN
    v_reasons := v_reasons ||
      '["TOTAL_MISSING"]'::jsonb;
  END IF;

  v_catalog_ready :=
    v_invalid_lines = 0
    AND v_valid_lines = v_line_count
    AND v_line_count BETWEEN 1 AND 60
    AND v_total_quantity BETWEEN 1 AND 100
    AND v_duplicate_ids = 0;

  inbox_id := v_order.id;
  platform := v_order.platform;
  processing_status := v_order.processing_status;

  line_count := v_line_count;
  total_quantity := v_total_quantity;
  valid_lines := v_valid_lines;
  invalid_lines := v_invalid_lines;

  catalog_ready := v_catalog_ready;

  -- Intentionally false until:
  -- monetary reconciliation, modifiers, payment,
  -- taxes, authorization and idempotent import
  -- have been implemented and independently tested.
  import_ready := false;

  verdict := CASE
    WHEN jsonb_array_length(v_reasons) > 0
      THEN 'REVIEW_REQUIRED'
    ELSE 'CATALOG_CHECK_PASSED'
  END;

  details := jsonb_build_object(
    'reasons', v_reasons,
    'lines', v_all_lines,
    'duplicateProductIds', v_duplicate_ids,
    'currency', v_order.currency,
    'totalGrosz', v_order.total_grosz,
    'financialValidation', 'NOT_IMPLEMENTED',
    'taxValidation', 'NOT_IMPLEMENTED',
    'modifierValidation', 'NOT_IMPLEMENTED',
    'automaticImportAllowed', false,
    'fiscalPrintAllowed', false
  );

  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION
public.rc_external_order_readiness(uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_order_readiness(uuid,uuid)
TO service_role;

COMMIT;
