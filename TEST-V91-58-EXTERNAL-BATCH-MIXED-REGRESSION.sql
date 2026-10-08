
-- ============================================================
-- RC ORDERA V91-58
-- MIXED BATCH REGRESSION
--
-- STAGING ONLY.
-- Uses an existing staging restaurant and its menu.
-- All INSERTs are rolled back.
-- No real order imports, payments, kitchen or POSNET.
-- ============================================================

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

DO $test$
DECLARE
  v_owner uuid;
  v_product_id text;

  v_good_id uuid := gen_random_uuid();
  v_bad_id uuid := gen_random_uuid();

  v_external_good text :=
    'test-' || gen_random_uuid()::text;

  v_external_bad text :=
    'test-' || gen_random_uuid()::text;

  v_good_payload jsonb;
  v_bad_payload jsonb;

  v_count integer;
  v_good_pass integer;
  v_bad_review integer;
  v_unsafe integer;
BEGIN

  IF to_regprocedure(
    'public.rc_external_batch_audit(uuid,integer,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_56_REQUIRED';
  END IF;

  IF to_regprocedure(
    'public.rc_external_set_product_mapping(uuid,text,text,text,boolean)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_48_REQUIRED';
  END IF;

  -- Find one unique, available product
  -- from an existing STAGING restaurant.
  WITH products AS (
    SELECT
      s.user_id,
      dish.value->>'id' AS product_id,
      dish.value->'available' AS available
    FROM public.app_settings s
    CROSS JOIN LATERAL jsonb_each(
      CASE
        WHEN jsonb_typeof(s.menu) = 'object'
        THEN s.menu
        ELSE '{}'::jsonb
      END
    ) category(key, value)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(category.value) = 'array'
        THEN category.value
        ELSE '[]'::jsonb
      END
    ) dish(value)
    WHERE jsonb_typeof(dish.value) = 'object'
  ),
  candidates AS (
    SELECT
      user_id,
      product_id
    FROM products
    WHERE product_id IS NOT NULL
      AND length(product_id) BETWEEN 1 AND 200
      AND product_id = btrim(product_id)
      AND product_id !~ '[[:cntrl:]]'
    GROUP BY user_id, product_id
    HAVING COUNT(*) = 1
       AND COUNT(*) FILTER (
         WHERE available = 'false'::jsonb
       ) = 0
  )
  SELECT user_id, product_id
  INTO v_owner, v_product_id
  FROM candidates
  ORDER BY user_id, product_id
  LIMIT 1;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION
      'NO_VALID_STAGING_MENU_PRODUCT';
  END IF;

  -- Install one test mapping, active.
  PERFORM *
  FROM public.rc_external_set_product_mapping(
    v_owner,
    'rc_test',
    v_external_good,
    v_product_id,
    true
  );

  -- Good order: mapped product and correct total.
  v_good_payload := jsonb_build_object(
    'items', jsonb_build_array(
      jsonb_build_object(
        'productId', v_external_good,
        'quantity', 2,
        'unitPriceGrosz', 1500,
        'lineTotalGrosz', 3000
      )
    ),
    'deliveryFeeGrosz', 500,
    'serviceFeeGrosz', 0,
    'discountGrosz', 0
  );

  -- Bad order: valid arithmetic,
  -- but deliberately unmapped product.
  v_bad_payload := jsonb_build_object(
    'items', jsonb_build_array(
      jsonb_build_object(
        'productId', v_external_bad,
        'quantity', 2,
        'unitPriceGrosz', 1500,
        'lineTotalGrosz', 3000
      )
    ),
    'deliveryFeeGrosz', 500,
    'serviceFeeGrosz', 0,
    'discountGrosz', 0
  );

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
    total_grosz,
    received_at
  )
  SELECT
    test.id,
    v_owner,
    'rc_test',
    'V91-58-' || test.id::text,
    'new',
    'received',
    test.payload,
    encode(
      extensions.digest(
        convert_to(test.payload::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    ),
    'PLN',
    3500,
    '1900-01-01 00:00:00+00'::timestamptz
  FROM (
    VALUES
      (v_good_id, v_good_payload),
      (v_bad_id, v_bad_payload)
  ) AS test(id, payload);

  -- Both test orders must be returned,
  -- with independent catalog verdicts.
  WITH audit AS MATERIALIZED (
    SELECT *
    FROM public.rc_external_batch_audit(
      v_owner, 10, 'received'
    )
  )
  SELECT
    COUNT(*) FILTER (
      WHERE inbox_id IN (v_good_id, v_bad_id)
    ),
    COUNT(*) FILTER (
      WHERE inbox_id = v_good_id
        AND catalog_valid IS TRUE
        AND arithmetic_valid IS TRUE
        AND review_required IS FALSE
        AND verdict = 'PRELIMINARY_CHECKS_PASSED'
    ),
    COUNT(*) FILTER (
      WHERE inbox_id = v_bad_id
        AND catalog_valid IS FALSE
        AND arithmetic_valid IS TRUE
        AND review_required IS TRUE
        AND verdict = 'CATALOG_REVIEW_REQUIRED'
    ),
    COUNT(*) FILTER (
      WHERE inbox_id IN (v_good_id, v_bad_id)
        AND (
          import_allowed IS DISTINCT FROM false
          OR fiscal_print_allowed IS DISTINCT FROM false
        )
    )
  INTO
    v_count,
    v_good_pass,
    v_bad_review,
    v_unsafe
  FROM audit;

  IF v_count <> 2 THEN
    RAISE EXCEPTION
      'FAIL: expected two test orders, got %',
      v_count;
  END IF;

  IF v_good_pass <> 1 THEN
    RAISE EXCEPTION
      'FAIL: valid order was not classified correctly';
  END IF;

  IF v_bad_review <> 1 THEN
    RAISE EXCEPTION
      'FAIL: unmapped order was not rejected';
  END IF;

  IF v_unsafe <> 0 THEN
    RAISE EXCEPTION
      'FAIL: unsafe import or fiscal authorization';
  END IF;

  RAISE NOTICE
    'PASS 1: valid order evaluated correctly';

  RAISE NOTICE
    'PASS 2: unmapped product rejected';

  RAISE NOTICE
    'PASS 3: both orders independently returned';

  RAISE NOTICE
    'PASS 4: import and fiscal printing blocked';

  RAISE NOTICE
    'V91-58 MIXED REGRESSION PASSED';

END;
$test$;

ROLLBACK;
