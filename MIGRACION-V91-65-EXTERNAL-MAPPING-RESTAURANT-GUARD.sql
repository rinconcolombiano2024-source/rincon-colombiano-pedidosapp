
-- ============================================================
-- RC ORDERA V91-65
-- EXTERNAL PRODUCT MAPPING RESTAURANT GUARD
--
-- Prevent mappings being created or modified
-- for deleted, inactive or missing restaurants.
--
-- Preserves existing products and historical data.
-- Does not modify orders, payments, kitchen or POSNET.
-- No cron, polling or background CPU consumption.
--
-- TEST FIRST IN STAGING.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regclass(
    'public.rc_external_product_mapping'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_46_REQUIRED';
  END IF;

  IF to_regclass(
    'public.restaurant_profiles'
  ) IS NULL THEN
    RAISE EXCEPTION 'RESTAURANT_PROFILES_REQUIRED';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION
public.rc_external_mapping_restaurant_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN

  -- Lock the restaurant profile for this transaction.
  -- Prevent concurrent profile updates from slipping
  -- between eligibility verification and mapping write.

  PERFORM 1
  FROM public.restaurant_profiles rp
  WHERE rp.user_id = NEW.restaurant_user_id
    AND rp.active IS TRUE
    AND rp.deleted_at IS NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'RESTAURANT_NOT_ELIGIBLE_FOR_EXTERNAL_MAPPING'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;

END;
$function$;

-- Validate all new and updated mapping rows.
-- DELETE remains possible for administrative cleanup.

CREATE OR REPLACE TRIGGER
rc_external_mapping_restaurant_guard_trg

BEFORE INSERT OR UPDATE
ON public.rc_external_product_mapping

FOR EACH ROW

EXECUTE FUNCTION
public.rc_external_mapping_restaurant_guard();

REVOKE ALL ON FUNCTION
public.rc_external_mapping_restaurant_guard()
FROM PUBLIC, anon, authenticated;

COMMIT;
