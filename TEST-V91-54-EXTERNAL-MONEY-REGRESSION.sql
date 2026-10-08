
-- ===================================================
-- RC ORDERA V91-54
-- MONEY VALIDATION REGRESSION
--
-- STAGING ONLY.
-- Reversible test, no persistent test orders.
-- No sales, kitchen, payments or POSNET writes.
-- ===================================================

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

DO $test$
DECLARE
  v_owner uuid :=
    '11111111-1111-4111-8111-111111111111';

  v_id uuid := gen_random_uuid();

  v_payload jsonb := '{
    "items": [
      {
        "productId": "test-arepa",
        "quantity": 2,
        "unitPriceGrosz": 1500,
        "lineTotalGrosz": 3000
      }
    ],
    "deliveryFeeGrosz": 500,
    "serviceFeeGrosz": 0,
    "discountGrosz": 0
  }'::jsonb;

  v_valid boolean;
  v_expected bigint;
  v_declared bigint;
  v_difference bigint;
  v_verdict text;
BEGIN

  IF to_regprocedure(
    'public.rc_external_validate_money(uuid,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_51_REQUIRED';
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
  VALUES (
    v_id,
    v_owner,
    'rc_test',
    'V91-54-' || v_id::text,
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
    3500
  );

  -- TEST 1: Total correcto.
  SELECT
    money_valid,
    expected_total_grosz,
    declared_total_grosz,
    difference_grosz,
    verdict
  INTO STRICT
    v_valid,
    v_expected,
    v_declared,
    v_difference,
    v_verdict
  FROM public.rc_external_validate_money(
    v_owner,
    v_id
  );

  IF v_valid IS DISTINCT FROM true
     OR v_expected IS DISTINCT FROM 3500
     OR v_declared IS DISTINCT FROM 3500
     OR v_difference IS DISTINCT FROM 0
     OR v_verdict IS DISTINCT FROM
        'ARITHMETIC_MATCH'
  THEN
    RAISE EXCEPTION
      'FAIL: CORRECT_TOTAL_VALIDATION';
  END IF;

  RAISE NOTICE
    'PASS 1: correct financial total';

  -- TEST 2: Incorrect declared total.
  UPDATE public.rc_external_delivery_inbox
  SET total_grosz = 3000
  WHERE id = v_id;

  SELECT
    money_valid,
    expected_total_grosz,
    declared_total_grosz,
    difference_grosz,
    verdict
  INTO STRICT
    v_valid,
    v_expected,
    v_declared,
    v_difference,
    v_verdict
  FROM public.rc_external_validate_money(
    v_owner,
    v_id
  );

  IF v_valid IS DISTINCT FROM false
     OR v_expected IS DISTINCT FROM 3500
     OR v_declared IS DISTINCT FROM 3000
     OR v_difference IS DISTINCT FROM -500
     OR v_verdict IS DISTINCT FROM
        'REVIEW_REQUIRED'
  THEN
    RAISE EXCEPTION
      'FAIL: INCORRECT_TOTAL_NOT_DETECTED';
  END IF;

  RAISE NOTICE
    'PASS 2: incorrect financial total detected';

  -- TEST 3: Missing monetary component.
  v_payload := v_payload -
    'deliveryFeeGrosz';

  UPDATE public.rc_external_delivery_inbox
  SET
    payload = v_payload,
    payload_sha256 = encode(
      extensions.digest(
        convert_to(v_payload::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    ),
    total_grosz = 3000
  WHERE id = v_id;

  SELECT money_valid, verdict
  INTO STRICT v_valid, v_verdict
  FROM public.rc_external_validate_money(
    v_owner,
    v_id
  );

  IF v_valid IS DISTINCT FROM false
     OR v_verdict IS DISTINCT FROM
       'REVIEW_REQUIRED'
  THEN
    RAISE EXCEPTION
      'FAIL: MISSING_FEE_NOT_DETECTED';
  END IF;

  RAISE NOTICE
    'PASS 3: missing fee detected';

  RAISE NOTICE
    'V91-54: ALL THREE ASSERTIONS PASSED';

END;
$test$;

ROLLBACK;
