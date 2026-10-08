
-- ======================================================
-- RC ORDERA V91-46
-- EXTERNAL PRODUCT MAPPING
--
-- Capa de correspondencia de catalogos.
-- No altera pedidos, pagos, cocina ni fiscal POSNET.
-- Sin cron, triggers, polling o llamadas externas.
--
-- INSTALAR Y PROBAR PRIMERO EN STAGING.
-- ======================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Verificar dependencias existentes.
DO $preflight$
BEGIN
  IF to_regclass(
    'public.rc_external_delivery_inbox'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_36_REQUIRED';
  END IF;

  IF to_regclass(
    'public.app_settings'
  ) IS NULL THEN
    RAISE EXCEPTION 'APP_SETTINGS_REQUIRED';
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS
public.rc_external_product_mapping (

  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  restaurant_user_id uuid NOT NULL,

  platform text NOT NULL
    CHECK (
      platform ~ '^[a-z][a-z0-9_]{1,39}$'
    ),

  external_product_id text NOT NULL
    CHECK (
      length(external_product_id)
        BETWEEN 1 AND 200
      AND external_product_id =
        btrim(external_product_id)
      AND external_product_id !~ '[[:cntrl:]]'
    ),

  internal_product_id text NOT NULL
    CHECK (
      length(internal_product_id)
        BETWEEN 1 AND 200
      AND internal_product_id =
        btrim(internal_product_id)
      AND internal_product_id !~ '[[:cntrl:]]'
    ),

  active boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL
    DEFAULT now(),

  updated_at timestamptz NOT NULL
    DEFAULT now(),

  CONSTRAINT rc_external_product_mapping_unique
    UNIQUE (
      restaurant_user_id,
      platform,
      external_product_id
    )
);

-- Indice para las futuras comprobaciones del menu.
CREATE INDEX IF NOT EXISTS
rc_external_product_mapping_internal_idx
ON public.rc_external_product_mapping (
  restaurant_user_id,
  internal_product_id
);

-- RLS obligatorio.
ALTER TABLE
public.rc_external_product_mapping
ENABLE ROW LEVEL SECURITY;

-- Nadie puede gestionar las correspondencias
-- directamente desde el navegador.
REVOKE ALL
ON public.rc_external_product_mapping
FROM PUBLIC, anon, authenticated;

-- Acceso reservado al backend.
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.rc_external_product_mapping
TO service_role;

COMMIT;
