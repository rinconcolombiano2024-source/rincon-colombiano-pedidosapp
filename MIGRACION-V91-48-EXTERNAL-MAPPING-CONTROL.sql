
-- ============================================================
-- RC ORDERA V91-48
-- CONTROLLED EXTERNAL PRODUCT MAPPING
--
-- Requires V91-46 and V91-47.
-- Create/update associations safely.
-- New associations remain inactive by default.
-- Active associations require a valid,
-- unique, available internal menu product.
--
-- Service role only.
-- No fiscal, financial, order or kitchen writes.
-- No cron or polling.
-- STAGING FIRST.
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

  IF to_regprocedure(
    'public.rc_external_validate_mappings(uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_47_REQUIRED';
  END IF;

  IF to_regclass('public.app_settings') IS NULL THEN
    RAISE EXCEPTION 'APP_SETTINGS_REQUIRED';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION
public.rc_external_set_product_mapping(
  p_restaurant_user_id uuid,
  p_platform text,
  p_external_product_id text,
  p_internal_product_id text,
  p_activate boolean DEFAULT false
)
RETURNS TABLE (
  mapping_id uuid,
  mapping_active boolean,
  result text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_menu jsonb;
  v_matches bigint;
  v_unavailable bigint;
  v_id uuid;
  v_active boolean;
BEGIN

  IF p_restaurant_user_id IS NULL THEN
    RAISE EXCEPTION 'RESTAURANT_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  IF p_platform IS NULL
     OR p_platform !~ '^[a-z][a-z0-9_]{1,39}$'
  THEN
    RAISE EXCEPTION 'INVALID_PLATFORM'
      USING ERRCODE = '22023';
  END IF;

  IF p_external_product_id IS NULL
     OR length(p_external_product_id)
        NOT BETWEEN 1 AND 200
     OR p_external_product_id <>
        btrim(p_external_product_id)
     OR p_external_product_id ~ '[[:cntrl:]]'
  THEN
    RAISE EXCEPTION 'INVALID_EXTERNAL_PRODUCT_ID'
      USING ERRCODE = '22023';
  END IF;

  IF p_internal_product_id IS NULL
     OR length(p_internal_product_id)
        NOT BETWEEN 1 AND 200
     OR p_internal_product_id <>
        btrim(p_internal_product_id)
     OR p_internal_product_id ~ '[[:cntrl:]]'
  THEN
    RAISE EXCEPTION 'INVALID_INTERNAL_PRODUCT_ID'
      USING ERRCODE = '22023';
  END IF;

  IF p_activate IS NULL THEN
    RAISE EXCEPTION 'ACTIVATION_FLAG_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  -- Lock settings while checking the menu.
  -- Prevents concurrent settings updates during
  -- this mapping transaction.
  SELECT s.menu
  INTO v_menu
  FROM public.app_settings s
  WHERE s.user_id = p_restaurant_user_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SETTINGS_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE item.value->'available' =
        'false'::jsonb
    )
  INTO
    v_matches,
    v_unavailable
  FROM jsonb_each(
    CASE
      WHEN jsonb_typeof(v_menu) = 'object'
      THEN v_menu
      ELSE '{}'::jsonb
    END
  ) AS category(key, value)
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(category.value) = 'array'
      THEN category.value
      ELSE '[]'::jsonb
    END
  ) AS item(value)
  WHERE jsonb_typeof(item.value) = 'object'
    AND btrim(
      coalesce(item.value->>'id', '')
    ) = p_internal_product_id;

  IF v_matches = 0 THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND'
      USING ERRCODE = '22023';
  END IF;

  IF v_matches <> 1 THEN
    RAISE EXCEPTION 'DUPLICATE_PRODUCT_ID'
      USING ERRCODE = '22023';
  END IF;

  IF v_unavailable > 0 AND p_activate THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'
      USING ERRCODE = '22023';
  END IF;

  -- Upsert is atomic and respects the
  -- unique constraint of V91-46.
  INSERT INTO public.rc_external_product_mapping (
    restaurant_user_id,
    platform,
    external_product_id,
    internal_product_id,
    active
  )
  VALUES (
    p_restaurant_user_id,
    p_platform,
    p_external_product_id,
    p_internal_product_id,
    p_activate
  )
  ON CONFLICT (
    restaurant_user_id,
    platform,
    external_product_id
  )
  DO UPDATE SET
    internal_product_id =
      EXCLUDED.internal_product_id,
    active = EXCLUDED.active,
    updated_at = now()
  WHERE
    public.rc_external_product_mapping.internal_product_id
      IS DISTINCT FROM EXCLUDED.internal_product_id
    OR
    public.rc_external_product_mapping.active
      IS DISTINCT FROM EXCLUDED.active
  RETURNING
    id,
    active
  INTO
    v_id,
    v_active;

  IF v_id IS NULL THEN
    SELECT m.id, m.active
    INTO STRICT v_id, v_active
    FROM public.rc_external_product_mapping m
    WHERE m.restaurant_user_id =
      p_restaurant_user_id
      AND m.platform = p_platform
      AND m.external_product_id =
        p_external_product_id;

    result := 'unchanged';
  ELSE
    result := 'saved';
  END IF;

  mapping_id := v_id;
  mapping_active := v_active;

  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION
public.rc_external_set_product_mapping(
  uuid,text,text,text,boolean
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_set_product_mapping(
  uuid,text,text,text,boolean
)
TO service_role;

COMMIT;
