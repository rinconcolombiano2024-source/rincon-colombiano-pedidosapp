
-- ============================================================
-- RC ORDERA V91-47
-- VALIDACION DE CORRESPONDENCIAS EXTERNAS
--
-- Dependencia: V91-46
-- Solo lectura del catalogo y correspondencias.
-- No activa asociaciones.
-- No modifica pedidos, ventas, cocina ni fiscal POSNET.
-- No introduce triggers, cron ni polling.
--
-- Ejecutar primero en STAGING.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- 1. Comprobar dependencias.

DO $preflight$
BEGIN
  IF to_regclass(
    'public.rc_external_product_mapping'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_46_REQUIRED';
  END IF;

  IF to_regclass(
    'public.app_settings'
  ) IS NULL THEN
    RAISE EXCEPTION 'APP_SETTINGS_REQUIRED';
  END IF;
END;
$preflight$;

-- 2. Crear validador exclusivamente de lectura.

CREATE OR REPLACE FUNCTION
public.rc_external_validate_mappings(
  p_restaurant_user_id uuid
)
RETURNS TABLE (
  mapping_id uuid,
  platform text,
  external_product_id text,
  internal_product_id text,
  active boolean,
  catalog_matches bigint,
  validation_status text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$

WITH mapping_rows AS (
  SELECT
    m.id,
    m.restaurant_user_id,
    m.platform,
    m.external_product_id,
    m.internal_product_id,
    m.active,
    s.user_id AS settings_owner,
    s.menu
  FROM public.rc_external_product_mapping m
  LEFT JOIN public.app_settings s
    ON s.user_id = m.restaurant_user_id
  WHERE m.restaurant_user_id =
    p_restaurant_user_id
),
checked AS (
  SELECT
    m.*,
    c.matches,
    c.unavailable_matches

  FROM mapping_rows m

  CROSS JOIN LATERAL (
    SELECT
      COUNT(*) AS matches,

      COUNT(*) FILTER (
        WHERE item.value->'available' =
          'false'::jsonb
      ) AS unavailable_matches

    FROM jsonb_each(
      CASE
        WHEN jsonb_typeof(m.menu) = 'object'
        THEN m.menu
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
      AND trim(
        coalesce(item.value->>'id', '')
      ) = m.internal_product_id

  ) c
)
SELECT
  c.id AS mapping_id,
  c.platform,
  c.external_product_id,
  c.internal_product_id,
  c.active,
  c.matches AS catalog_matches,

  CASE
    WHEN c.settings_owner IS NULL
      THEN 'SETTINGS_NOT_FOUND'

    WHEN c.matches = 0
      THEN 'PRODUCT_NOT_FOUND'

    WHEN c.matches > 1
      THEN 'DUPLICATE_PRODUCT_ID'

    WHEN c.unavailable_matches > 0
      THEN 'PRODUCT_UNAVAILABLE'

    WHEN NOT c.active
      THEN 'VALID_INACTIVE'

    ELSE 'VALID_ACTIVE'

  END AS validation_status

FROM checked c

ORDER BY
  c.platform,
  c.external_product_id,
  c.id;

$function$;

-- 3. Restringir su ejecucion.

REVOKE ALL ON FUNCTION
public.rc_external_validate_mappings(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_validate_mappings(uuid)
TO service_role;

COMMIT;
