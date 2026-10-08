
-- ==========================================================
-- RC ORDERA V91-49
-- EXTERNAL ORDER ITEM INSPECTION
--
-- Requires V91-36, V91-46, V91-48.
-- Read-only validation.
-- No order creation, sales, fiscal or kitchen writes.
-- No triggers, cron or polling.
-- STAGING FIRST.
-- ==========================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regclass(
    'public.rc_external_delivery_inbox'
  ) IS NULL
  OR to_regclass(
    'public.rc_external_product_mapping'
  ) IS NULL
  OR to_regclass(
    'public.app_settings'
  ) IS NULL THEN
    RAISE EXCEPTION 'EXTERNAL_DEPENDENCIES_MISSING';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION
public.rc_external_check_order_items(
  p_restaurant_user_id uuid,
  p_inbox_id uuid
)
RETURNS TABLE (
  line_number integer,
  external_product_id text,
  internal_product_id text,
  quantity integer,
  validation_status text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_order public.rc_external_delivery_inbox%ROWTYPE;
  v_menu jsonb;
  v_items jsonb;
  v_item jsonb;
  v_external_id text;
  v_internal_id text;
  v_qty_text text;
  v_qty integer;
  v_matches bigint;
  v_unavailable bigint;
  v_active boolean;
  v_number integer := 0;
BEGIN
  IF p_restaurant_user_id IS NULL
     OR p_inbox_id IS NULL THEN
    RAISE EXCEPTION 'IDENTIFIERS_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_order
  FROM public.rc_external_delivery_inbox i
  WHERE i.id = p_inbox_id
    AND i.restaurant_user_id = p_restaurant_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT s.menu
  INTO v_menu
  FROM public.app_settings s
  WHERE s.user_id = p_restaurant_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SETTINGS_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  v_items := v_order.payload -> 'items';

  IF jsonb_typeof(v_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(
       CASE
         WHEN jsonb_typeof(v_items) = 'array'
         THEN v_items
         ELSE '[]'::jsonb
       END
     ) NOT BETWEEN 1 AND 60
  THEN
    line_number := 0;
    external_product_id := NULL;
    internal_product_id := NULL;
    quantity := NULL;
    validation_status := 'INVALID_ITEMS';
    RETURN NEXT;
    RETURN;
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(v_items)
  LOOP
    v_number := v_number + 1;
    line_number := v_number;
    external_product_id := NULL;
    internal_product_id := NULL;
    quantity := NULL;
    validation_status := NULL;

    IF jsonb_typeof(v_item) <> 'object' THEN
      validation_status := 'INVALID_ITEM';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Contrato preliminar: cada articulo
    -- debe incluir productId y quantity.
    v_external_id := v_item ->> 'productId';

    v_qty_text := v_item ->> 'quantity';

    IF v_external_id IS NULL
       OR length(v_external_id) NOT BETWEEN 1 AND 200
       OR v_external_id <> btrim(v_external_id)
       OR v_external_id ~ '[[:cntrl:]]'
    THEN
      validation_status := 'INVALID_PRODUCT_ID';
      RETURN NEXT;
      CONTINUE;
    END IF;

    external_product_id := v_external_id;

    -- Solo cantidades enteras de 1 a 100.
    -- Limita conversiones y volumen por linea.
    IF jsonb_typeof(v_item -> 'quantity') <> 'number'
       OR v_qty_text !~ '^[1-9][0-9]{0,2}$'
       OR v_qty_text::integer > 100
    THEN
      validation_status := 'INVALID_QUANTITY';
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_qty := v_qty_text::integer;
    quantity := v_qty;

    -- Identificar asociacion para ESTE
    -- restaurante y ESTA plataforma.
    SELECT m.internal_product_id, m.active
    INTO v_internal_id, v_active
    FROM public.rc_external_product_mapping m
    WHERE m.restaurant_user_id = p_restaurant_user_id
      AND m.platform = v_order.platform
      AND m.external_product_id = v_external_id;

    IF NOT FOUND THEN
      validation_status := 'MAPPING_NOT_FOUND';
      RETURN NEXT;
      CONTINUE;
    END IF;

    internal_product_id := v_internal_id;

    IF NOT v_active THEN
      validation_status := 'MAPPING_INACTIVE';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Verificar contra el menu ACTUAL.
    SELECT
      COUNT(*),
      COUNT(*) FILTER (
        WHERE dish.value -> 'available' =
          'false'::jsonb
      )
    INTO v_matches, v_unavailable
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
    ) AS dish(value)
    WHERE jsonb_typeof(dish.value) = 'object'
      AND btrim(coalesce(dish.value ->> 'id', ''))
          = v_internal_id;

    IF v_matches = 0 THEN
      validation_status := 'PRODUCT_NOT_FOUND';
    ELSIF v_matches > 1 THEN
      validation_status := 'DUPLICATE_PRODUCT_ID';
    ELSIF v_unavailable > 0 THEN
      validation_status := 'PRODUCT_UNAVAILABLE';
    ELSE
      validation_status := 'CATALOG_VALID';
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION
public.rc_external_check_order_items(uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_check_order_items(uuid,uuid)
TO service_role;

COMMIT;
