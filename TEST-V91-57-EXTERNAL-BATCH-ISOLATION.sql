
-- =========================================================
-- RC ORDERA V91-57
-- BATCH ERROR ISOLATION REGRESSION
--
-- STAGING ONLY
-- No permanent changes: ROLLBACK.
-- No customer_orders, payments, fiscal or kitchen writes.
-- =========================================================

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

DO $test$
DECLARE
  v_owner uuid :=
    '11111111-1111-4111-8111-111111111111';

  v_first uuid := gen_random_uuid();
  v_second uuid := gen_random_uuid();

  v_payload jsonb := '{
    "items": [{
      "productId": "test-product",
      "quantity": 1,
      "unitPriceGrosz": 1500,
      "lineTotalGrosz": 1500
    }],
    "deliveryFeeGrosz": 0,
    "serviceFeeGrosz": 0,
    "discountGrosz": 0
  }'::jsonb;

  v_rows integer;
  v_errors integer;
  v_unsafe integer;
  v_unexpected integer;
BEGIN

  IF to_regprocedure(
    'public.rc_external_batch_audit(uuid,integer,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_56_REQUIRED';
  END IF;

  -- Avoid touching any real restaurant identity.
  IF EXISTS (
    SELECT 1
    FROM public.app_settings
    WHERE user_id = v_owner
  ) THEN
    RAISE EXCEPTION 'TEST_OWNER_HAS_SETTINGS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.rc_external_delivery_inbox
    WHERE restaurant_user_id = v_owner
  ) THEN
    RAISE EXCEPTION 'TEST_OWNER_HAS_EXISTING_ORDERS';
  END IF;

  INSERT INTO public.rc_external_delivery_inbox (
    id,
    restaurant_user_id,
    platform,
    external_order_id,
    source_status,
    processing_status,
    payload,
    payload_sha256,
    currency,
    total_grosz
  )
  SELECT
    x.order_id,
    v_owner,
    'rc_test',
    'V91-57-' || x.order_id::text,
    'new',
    'received',
    v_payload,
    encode(
      extensions.digest(
        convert_to(v_payload::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    ),
    'PLN',
    1500
  FROM (
    VALUES (v_first), (v_second)
  ) AS x(order_id);

  -- Both orders lack restaurant settings.
  -- Both must return independent safe errors.
  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE verdict = 'AUDIT_ERROR'
    ),
    COUNT(*) FILTER (
      WHERE import_allowed IS DISTINCT FROM false
         OR fiscal_print_allowed IS DISTINCT FROM false
    ),
    COUNT(*) FILTER (
      WHERE review_required IS DISTINCT FROM true
         OR catalog_valid IS DISTINCT FROM false
         OR arithmetic_valid IS DISTINCT FROM false
         OR inbox_id NOT IN (v_first, v_second)
    )
  INTO
    v_rows,
    v_errors,
    v_unsafe,
    v_unexpected
  FROM public.rc_external_batch_audit(
    v_owner, 10, 'received'
  );

  IF v_rows <> 2 THEN
    RAISE EXCEPTION
      'FAIL_ROW_ISOLATION: expected 2, got %',
      v_rows;
  END IF;

  IF v_errors <> 2 THEN
    RAISE EXCEPTION
      'FAIL_ERROR_ISOLATION: expected 2, got %',
      v_errors;
  END IF;

  IF v_unsafe <> 0 OR v_unexpected <> 0 THEN
    RAISE EXCEPTION 'FAIL_SECURITY_FLAGS';
  END IF;

  RAISE NOTICE
    'PASS: two orders returned independently';

  RAISE NOTICE
    'PASS: both validation errors isolated';

  RAISE NOTICE
    'PASS: import and fiscal printing blocked';

  RAISE NOTICE
    'V91-57 NEGATIVE REGRESSION PASSED';

END;
$test$;

ROLLBACK;
