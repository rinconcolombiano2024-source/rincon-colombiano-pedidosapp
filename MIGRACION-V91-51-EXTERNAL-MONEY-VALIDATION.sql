
-- ============================================================
-- RC ORDERA V91-51
-- EXTERNAL MONEY RECONCILIATION
--
-- Read-only arithmetic validation.
-- No sales, kitchen, payments or POSNET writes.
-- No cron, triggers or background polling.
--
-- Expected normalized payload:
-- {
--   "items": [
--     {
--       "productId": "external-1",
--       "quantity": 2,
--       "unitPriceGrosz": 1500,
--       "lineTotalGrosz": 3000
--     }
--   ],
--   "deliveryFeeGrosz": 500,
--   "serviceFeeGrosz": 0,
--   "discountGrosz": 0
-- }
--
-- All amounts are integer PLN grosz.
-- Missing values are NOT assumed to be zero.
-- Staging first.
-- ============================================================

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
    'public.rc_external_order_readiness(uuid,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_50_REQUIRED';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION
public.rc_external_validate_money(
  p_restaurant_user_id uuid,
  p_inbox_id uuid
)
RETURNS TABLE (
  inbox_id uuid,
  expected_total_grosz bigint,
  declared_total_grosz bigint,
  difference_grosz bigint,
  money_valid boolean,
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
  v_payload jsonb;
  v_items jsonb;
  v_item jsonb;

  v_qty bigint;
  v_unit bigint;
  v_line bigint;

  v_items_total bigint := 0;
  v_delivery bigint;
  v_service bigint;
  v_discount bigint;

  v_field text;
  v_raw jsonb;
  v_num bigint;

  v_valid boolean := true;
  v_errors jsonb := '[]'::jsonb;
  v_index integer := 0;
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

  v_payload := v_order.payload;
  v_items := v_payload -> 'items';

  -- Limit work to the same 1..60 item contract.
  IF jsonb_typeof(v_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(
       CASE
         WHEN jsonb_typeof(v_items) = 'array'
         THEN v_items
         ELSE '[]'::jsonb
       END
     ) NOT BETWEEN 1 AND 60
  THEN
    v_valid := false;
    v_errors := v_errors ||
      '["INVALID_ITEMS"]'::jsonb;
  ELSE
    FOR v_item IN
      SELECT value
      FROM jsonb_array_elements(v_items)
    LOOP
      v_index := v_index + 1;

      IF jsonb_typeof(v_item) <> 'object' THEN
        v_valid := false;
        v_errors := v_errors ||
          jsonb_build_array(
            'INVALID_ITEM_' || v_index
          );
        CONTINUE;
      END IF;

      -- Validate numeric JSON values before casting.
      IF jsonb_typeof(v_item -> 'quantity')
           IS DISTINCT FROM 'number'
         OR jsonb_typeof(v_item -> 'unitPriceGrosz')
           IS DISTINCT FROM 'number'
         OR jsonb_typeof(v_item -> 'lineTotalGrosz')
           IS DISTINCT FROM 'number'
         OR coalesce(v_item ->> 'quantity', '')
           !~ '^[1-9][0-9]{0,2}$'
         OR coalesce(v_item ->> 'unitPriceGrosz', '')
           !~ '^(0|[1-9][0-9]{0,9})$'
         OR coalesce(v_item ->> 'lineTotalGrosz', '')
           !~ '^(0|[1-9][0-9]{0,11})$'
      THEN
        v_valid := false;
        v_errors := v_errors ||
          jsonb_build_array(
            'INVALID_LINE_MONEY_' || v_index
          );
        CONTINUE;
      END IF;

      v_qty := (v_item ->> 'quantity')::bigint;
      v_unit := (v_item ->> 'unitPriceGrosz')::bigint;
      v_line := (v_item ->> 'lineTotalGrosz')::bigint;

      IF v_qty > 100
         OR v_line <> v_qty * v_unit
      THEN
        v_valid := false;
        v_errors := v_errors ||
          jsonb_build_array(
            'LINE_TOTAL_MISMATCH_' || v_index
          );
        CONTINUE;
      END IF;

      v_items_total := v_items_total + v_line;
    END LOOP;
  END IF;

  -- Every charge must be explicitly provided.
  FOREACH v_field IN ARRAY ARRAY[
    'deliveryFeeGrosz',
    'serviceFeeGrosz',
    'discountGrosz'
  ]
  LOOP
    v_raw := v_payload -> v_field;

    IF jsonb_typeof(v_raw) IS DISTINCT FROM 'number'
       OR coalesce(v_raw::text, '')
         !~ '^(0|[1-9][0-9]{0,10})$'
    THEN
      v_valid := false;
      v_errors := v_errors ||
        jsonb_build_array('INVALID_' || v_field);
      CONTINUE;
    END IF;

    v_num := (v_raw::text)::bigint;

    CASE v_field
      WHEN 'deliveryFeeGrosz' THEN
        v_delivery := v_num;
      WHEN 'serviceFeeGrosz' THEN
        v_service := v_num;
      WHEN 'discountGrosz' THEN
        v_discount := v_num;
    END CASE;
  END LOOP;

  inbox_id := v_order.id;
  declared_total_grosz := v_order.total_grosz;

  IF v_order.currency IS DISTINCT FROM 'PLN' THEN
    v_valid := false;
    v_errors := v_errors ||
      '["UNSUPPORTED_CURRENCY"]'::jsonb;
  END IF;

  IF declared_total_grosz IS NULL THEN
    v_valid := false;
    v_errors := v_errors ||
      '["MISSING_DECLARED_TOTAL"]'::jsonb;
  END IF;

  -- Recalculate only when every required
  -- numeric component is valid.
  IF v_valid THEN
    expected_total_grosz :=
      v_items_total +
      v_delivery +
      v_service -
      v_discount;

    IF expected_total_grosz < 0 THEN
      v_valid := false;
      v_errors := v_errors ||
        '["NEGATIVE_EXPECTED_TOTAL"]'::jsonb;
    ELSE
      difference_grosz :=
        declared_total_grosz -
        expected_total_grosz;

      IF difference_grosz <> 0 THEN
        v_valid := false;
        v_errors := v_errors ||
          '["TOTAL_MISMATCH"]'::jsonb;
      END IF;
    END IF;
  END IF;

  money_valid := v_valid;

  verdict := CASE
    WHEN v_valid
      THEN 'ARITHMETIC_MATCH'
    ELSE 'REVIEW_REQUIRED'
  END;

  details := jsonb_build_object(
    'reasons', v_errors,
    'itemsTotalGrosz', v_items_total,
    'deliveryFeeGrosz', v_delivery,
    'serviceFeeGrosz', v_service,
    'discountGrosz', v_discount,
    'currency', v_order.currency,
    'providerSettlementValidated', false,
    'taxValidated', false,
    'modifiersValidated', false,
    'paymentValidated', false,
    'importAllowed', false,
    'fiscalPrintAllowed', false
  );

  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION
public.rc_external_validate_money(uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_validate_money(uuid,uuid)
TO service_role;

COMMIT;
