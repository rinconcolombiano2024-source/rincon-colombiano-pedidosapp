
-- =====================================================
-- RC ORDERA V91-40
-- EXTERNAL DELIVERY TENANT INTEGRITY
--
-- Requiere V91-36 y V91-38.
-- Instalar primero en staging.
--
-- No modifica importes, pedidos ni fiscal.
-- No añade cron, polling ni triggers.
-- =====================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- 1. Validar dependencias

DO $preflight$
BEGIN

  IF to_regclass(
    'public.rc_external_delivery_inbox'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91-36_REQUIRED';
  END IF;

  IF to_regclass(
    'public.rc_external_delivery_events'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91-38_REQUIRED';
  END IF;

  -- No continuar si existen eventos
  -- asociados a otros restaurantes.
  IF EXISTS (
    SELECT 1
    FROM public.rc_external_delivery_events e
    LEFT JOIN public.rc_external_delivery_inbox i
      ON i.id = e.inbox_id
    WHERE i.id IS NULL
       OR i.restaurant_user_id
          IS DISTINCT FROM e.restaurant_user_id
       OR i.platform
          IS DISTINCT FROM e.platform
  ) THEN
    RAISE EXCEPTION
      'CROSS_TENANT_EVENTS_REQUIRE_REVIEW';
  END IF;

END;
$preflight$;

-- 2. Clave unica compuesta en inbox.
-- Necesaria para la referencia completa.

CREATE UNIQUE INDEX IF NOT EXISTS
rc_external_inbox_tenant_identity_idx
ON public.rc_external_delivery_inbox (
  id,
  restaurant_user_id,
  platform
);

-- 3. Impedir vinculaciones cruzadas.

DO $constraint$
BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid =
      'public.rc_external_delivery_events'::regclass
      AND conname =
      'rc_external_event_tenant_fk'
  ) THEN

    ALTER TABLE
      public.rc_external_delivery_events

    ADD CONSTRAINT
      rc_external_event_tenant_fk

    FOREIGN KEY (
      inbox_id,
      restaurant_user_id,
      platform
    )

    REFERENCES
      public.rc_external_delivery_inbox (
        id,
        restaurant_user_id,
        platform
      )

    ON UPDATE RESTRICT
    ON DELETE RESTRICT;

  END IF;

END;
$constraint$;

COMMIT;
