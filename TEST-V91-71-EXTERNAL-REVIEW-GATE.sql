
-- ============================================================
-- RC ORDERA V91-71
-- EXTERNAL REVIEW GATE REGRESSION TEST
--
-- STAGING ONLY - NEVER RUN ON PRODUCTION.
--
-- Requires V91-69 and V91-70 applied.
--
-- Tests:
-- 1. Valid catalog and valid money
-- 2. Unmapped external product
-- 3. Incorrect declared total
-- 4. Ineligible restaurant
-- 5. Cross-tenant access
-- 6. Import and fiscal permissions denied
-- 7. Mandatory review after preliminary checks
--
-- All test writes are inside one transaction.
-- The transaction ends with ROLLBACK.
--
-- No fiscal hardware communication.
-- No internal order creation.
-- No payment or accounting writes.
-- No background processes.
-- ============================================================

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

DO $test$
DECLARE
  v_owner uuid;
  v_product_id text;

  v_good_id uuid := gen_random_uuid();
  v_unmapped_id uuid := gen_random_uuid();
  v_bad_money_id uuid := gen_random_uuid();

  v_ineligible_owner uuid := gen_random_uuid();
  v_ineligible_id uuid := gen_random_uuid();

  v_mapped_product text :=
    'v91-71-' || gen_random_uuid()::text;

  v_unmapped_product text :=
    'v91-71-' || gen_random_uuid()::text;

  v_good_payload jsonb;
  v_unmapped_payload jsonb;

  v_count bigint;
  v_good_count bigint;
  v_unmapped_count bigint;
  v_bad_money_count bigint;
  v_unsafe_count bigint;

  v_negative record;
  v_cross_tenant_rejected boolean := false;
BEGIN

  -- ==========================================================
  -- 1. PREFLIGHT
  -- ==========================================================

  IF to_regclass(
    'public.rc_external_delivery_inbox'
  ) IS NULL
  OR to_regclass(
    'public.rc_external_product_mapping'
  ) IS NULL
  OR to_regclass(
    'public.app_settings'
  ) IS NULL
  OR to_regclass(
    'public.restaurant_profiles'
  ) IS NULL
  THEN
    RAISE EXCEPTION
      'V91_71_REQUIRED_TABLES_MISSING';
  END IF;

  IF to_regprocedure(
    'public.rc_external_consolidated_audit(uuid,uuid)'
  ) IS NULL
  OR to_regprocedure(
    'public.rc_external_batch_audit(uuid,integer,text)'
  ) IS NULL
  OR to_regprocedure(
    'public.rc_external_set_product_mapping(uuid,text,text,text,boolean)'
  ) IS NULL
  THEN
    RAISE EXCEPTION
      'V91_71_REQUIRED_FUNCTIONS_MISSING';
  END IF;

  IF to_regprocedure(
    'extensions.digest(bytea,text)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'V91_71_PGCRYPTO_MISSING';
  END IF;

  -- ==========================================================
  -- 2. SELECT SAFE STAGING RESTAURANT
  -- ==========================================================

  -- Select a staging restaurant with an active profile,
  -- one unique available product and no received orders.
  --
  -- This avoids mixing preexisting records into
  -- the bounded batch assertion.

  WITH products AS (
    SELECT
      s.user_id,
      dish.value ->> 'id' AS product_id,
      dish.value -> 'available' AS available
    FROM public.app_settings s

    JOIN public.restaurant_profiles rp
      ON rp.user_id = s.user_id
     AND rp.active IS TRUE
     AND rp.deleted_at IS NULL

    CROSS JOIN LATERAL jsonb_each(
      CASE
        WHEN jsonb_typeof(s.menu) = 'object'
        THEN s.menu
        ELSE '{}'::jsonb
      END
    ) AS category(key, value)

    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(category.value) = 'array'
        THEN category.value
        ELSE '[]'::jsonb
      END
    ) AS dish(value)

    WHERE jsonb_typeof(dish.value) = 'object'
      AND NOT EXISTS (
        SELECT 1
        FROM public.rc_external_delivery_inbox i
        WHERE i.restaurant_user_id = s.user_id
          AND i.processing_status = 'received'
      )
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

  SELECT
    user_id,
    product_id
  INTO
    v_owner,
    v_product_id
  FROM candidates
  ORDER BY user_id, product_id
  LIMIT 1;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION
      'NO_ELIGIBLE_STAGING_RESTAURANT_WITH_FREE_INBOX';
  END IF;

  -- ==========================================================
  -- 3. CREATE TEST MAPPING
  -- ==========================================================

  PERFORM 1
  FROM public.rc_external_set_product_mapping(
    v_owner,
    'rc_test',
    v_mapped_product,
    v_product_id,
    true
  );

  -- ==========================================================
  -- 4. BUILD TEST PAYLOADS
  -- ==========================================================

  v_good_payload := jsonb_build_object(
    'items', jsonb_build_array(
      jsonb_build_object(
        'productId', v_mapped_product,
        'quantity', 2,
        'unitPriceGrosz', 1500,
        'lineTotalGrosz', 3000
      )
    ),
    'deliveryFeeGrosz', 500,
    'serviceFeeGrosz', 0,
    'discountGrosz', 0
  );

  v_unmapped_payload := jsonb_build_object(
    'items', jsonb_build_array(
      jsonb_build_object(
        'productId', v_unmapped_product,
        'quantity', 2,
        'unitPriceGrosz', 1500,
        'lineTotalGrosz', 3000
      )
    ),
    'deliveryFeeGrosz', 500,
    'serviceFeeGrosz', 0,
    'discountGrosz', 0
  );

  -- ==========================================================
  -- 5. INSERT THREE TEST ORDERS
  -- ==========================================================

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
    sample.id,
    v_owner,
    'rc_test',
    'V91-71-' || sample.id::text,
    'new',
    'received',
    sample.payload,
    encode(
      extensions.digest(
        convert_to(sample.payload::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    ),
    'PLN',
    sample.total_grosz,
    '1800-01-01 00:00:00+00'::timestamptz

  FROM (
    VALUES
      (
        v_good_id,
        v_good_payload,
        3500::bigint
      ),
      (
        v_unmapped_id,
        v_unmapped_payload,
        3500::bigint
      ),
      (
        v_bad_money_id,
        v_good_payload,
        3600::bigint
      )
  ) AS sample(id, payload, total_grosz);

  -- ==========================================================
  -- 6. VALIDATE BATCH RESULTS
  -- ==========================================================

  WITH audit AS MATERIALIZED (
    SELECT *
    FROM public.rc_external_batch_audit(
      v_owner,
      10,
      'received'
    )
  )

  SELECT
    COUNT(*) FILTER (
      WHERE inbox_id IN (
        v_good_id,
        v_unmapped_id,
        v_bad_money_id
      )
    ),

    COUNT(*) FILTER (
      WHERE inbox_id = v_good_id
        AND catalog_valid IS TRUE
        AND arithmetic_valid IS TRUE
        AND review_required IS TRUE
        AND verdict = 'PRELIMINARY_CHECKS_PASSED'
    ),

    COUNT(*) FILTER (
      WHERE inbox_id = v_unmapped_id
        AND catalog_valid IS FALSE
        AND arithmetic_valid IS TRUE
        AND review_required IS TRUE
        AND verdict = 'CATALOG_REVIEW_REQUIRED'
    ),

    COUNT(*) FILTER (
      WHERE inbox_id = v_bad_money_id
        AND catalog_valid IS TRUE
        AND arithmetic_valid IS FALSE
        AND review_required IS TRUE
        AND verdict = 'MONEY_REVIEW_REQUIRED'
    ),

    COUNT(*) FILTER (
      WHERE inbox_id IN (
        v_good_id,
        v_unmapped_id,
        v_bad_money_id
      )
      AND (
        import_allowed IS DISTINCT FROM false
        OR fiscal_print_allowed IS DISTINCT FROM false
        OR review_required IS DISTINCT FROM true
      )
    )

  INTO
    v_count,
    v_good_count,
    v_unmapped_count,
    v_bad_money_count,
    v_unsafe_count

  FROM audit;

  IF v_count <> 3 THEN
    RAISE EXCEPTION
      'FAIL_BATCH_COUNT: expected 3, got %',
      v_count;
  END IF;

  IF v_good_count <> 1 THEN
    RAISE EXCEPTION
      'FAIL_VALID_ORDER_REVIEW_CONTRACT';
  END IF;

  IF v_unmapped_count <> 1 THEN
    RAISE EXCEPTION
      'FAIL_UNMAPPED_PRODUCT_REVIEW';
  END IF;

  IF v_bad_money_count <> 1 THEN
    RAISE EXCEPTION
      'FAIL_MONETARY_REVIEW';
  END IF;

  IF v_unsafe_count <> 0 THEN
    RAISE EXCEPTION
      'FAIL_UNSAFE_AUTHORIZATION_FLAGS';
  END IF;

  -- ==========================================================
  -- 7. TEST INELIGIBLE RESTAURANT
  -- ==========================================================

  -- Reject an unexpected identity collision.
  IF EXISTS (
    SELECT 1
    FROM public.restaurant_profiles rp
    WHERE rp.user_id = v_ineligible_owner
  ) THEN
    RAISE EXCEPTION
      'TEST_IDENTITY_COLLISION';
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
    v_ineligible_id,
    v_ineligible_owner,
    'rc_test',
    'V91-71-' || v_ineligible_id::text,
    'new',
    'received',
    v_good_payload,
    encode(
      extensions.digest(
        convert_to(v_good_payload::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    ),
    'PLN',
    3500
  );

  SELECT
    a.verdict,
    a.catalog_valid,
    a.arithmetic_valid,
    a.review_required,
    a.import_allowed,
    a.fiscal_print_allowed
  INTO STRICT v_negative
  FROM public.rc_external_consolidated_audit(
    v_ineligible_owner,
    v_ineligible_id
  ) AS a;

  IF v_negative.verdict IS DISTINCT FROM
       'RESTAURANT_NOT_ELIGIBLE'
    OR v_negative.catalog_valid IS DISTINCT FROM false
    OR v_negative.arithmetic_valid IS DISTINCT FROM false
    OR v_negative.review_required IS DISTINCT FROM true
    OR v_negative.import_allowed IS DISTINCT FROM false
    OR v_negative.fiscal_print_allowed IS DISTINCT FROM false
  THEN
    RAISE EXCEPTION
      'FAIL_INELIGIBLE_RESTAURANT_GUARD';
  END IF;

  -- ==========================================================
  -- 8. TEST CROSS-TENANT ACCESS
  -- ==========================================================

  BEGIN
    PERFORM *
    FROM public.rc_external_consolidated_audit(
      v_owner,
      v_ineligible_id
    );
  EXCEPTION
    WHEN SQLSTATE 'P0002' THEN
      v_cross_tenant_rejected := true;
  END;

  IF v_cross_tenant_rejected IS NOT TRUE THEN
    RAISE EXCEPTION
      'FAIL_CROSS_TENANT_ACCESS';
  END IF;

  -- ==========================================================
  -- 9. SUCCESS REPORT
  -- ==========================================================

  RAISE NOTICE
    'PASS: valid order remains under review';

  RAISE NOTICE
    'PASS: unmapped product rejected';

  RAISE NOTICE
    'PASS: incorrect monetary total rejected';

  RAISE NOTICE
    'PASS: all three orders evaluated';

  RAISE NOTICE
    'PASS: import and fiscal permissions denied';

  RAISE NOTICE
    'PASS: ineligible restaurant rejected';

  RAISE NOTICE
    'PASS: cross-tenant access rejected';

  RAISE NOTICE
    'V91-71 REGRESSION TEST PASSED';

END;
$test$;

-- Remove all test orders and mappings.
ROLLBACK;

-- ============================================================
-- END RC ORDERA V91-71
-- ============================================================
