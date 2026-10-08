
-- =====================================================
-- RC ORDERA V91-39
-- SECURE EXTERNAL EVENT REGISTRATION
--
-- Requiere V91-36, V91-37 y V91-38.
-- Ejecutar primero en STAGING.
--
-- No modifica pedidos ni operaciones fiscales.
-- Sin cron, triggers, polling o Realtime.
-- =====================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- 1. PREFLIGHT

DO $preflight$
BEGIN

  IF to_regclass(
    'public.rc_external_delivery_inbox'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91-36_REQUIRED';
  END IF;

  IF to_regprocedure(
    'public.rc_external_ingest_order(uuid,text,text,text,jsonb,text,text,bigint)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91-37_REQUIRED';
  END IF;

  IF to_regclass(
    'public.rc_external_delivery_events'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91-38_REQUIRED';
  END IF;

  IF to_regprocedure(
    'extensions.digest(bytea,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'PGCRYPTO_REQUIRED';
  END IF;

END;
$preflight$;

-- 2. REGISTRO ATOMICO DE EVENTOS

CREATE OR REPLACE FUNCTION
public.rc_external_register_event(
  p_inbox_id uuid,
  p_restaurant_user_id uuid,
  p_platform text,
  p_external_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_source_created_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  event_id uuid,
  result text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$

DECLARE
  v_inbox public.rc_external_delivery_inbox%ROWTYPE;
  v_existing public.rc_external_delivery_events%ROWTYPE;
  v_hash text;
  v_new_id uuid;

BEGIN

  -- Validar identificadores.

  IF p_inbox_id IS NULL
     OR p_restaurant_user_id IS NULL
  THEN
    RAISE EXCEPTION 'INVALID_IDENTIFIERS'
      USING ERRCODE = '22023';
  END IF;

  IF p_platform IS NULL
     OR p_platform !~ '^[a-z][a-z0-9_]{1,39}$'
  THEN
    RAISE EXCEPTION 'INVALID_PLATFORM'
      USING ERRCODE = '22023';
  END IF;

  IF p_external_event_id IS NULL
     OR length(p_external_event_id)
        NOT BETWEEN 1 AND 160
     OR p_external_event_id <> btrim(p_external_event_id)
     OR p_external_event_id ~ '[[:cntrl:]]'
  THEN
    RAISE EXCEPTION 'INVALID_EVENT_ID'
      USING ERRCODE = '22023';
  END IF;

  IF p_event_type IS NULL
     OR length(p_event_type)
        NOT BETWEEN 1 AND 80
     OR p_event_type <> btrim(p_event_type)
     OR p_event_type ~ '[[:cntrl:]]'
  THEN
    RAISE EXCEPTION 'INVALID_EVENT_TYPE'
      USING ERRCODE = '22023';
  END IF;

  IF p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object'
     OR octet_length(p_payload::text) > 65536
  THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD'
      USING ERRCODE = '22023';
  END IF;

  -- Verificar pertenencia del evento.
  -- Compartir el bloqueo de lectura impide
  -- modificaciones concurrentes incompatibles
  -- mientras registramos el evento.

  SELECT *
  INTO v_inbox
  FROM public.rc_external_delivery_inbox
  WHERE id = p_inbox_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INBOX_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_inbox.restaurant_user_id
       IS DISTINCT FROM p_restaurant_user_id
     OR v_inbox.platform
       IS DISTINCT FROM p_platform
  THEN
    RAISE EXCEPTION 'EVENT_OWNER_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  -- SHA-256 calculado en servidor.

  v_hash := encode(
    extensions.digest(
      convert_to(p_payload::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  -- La restriccion UNIQUE de V91-38 evita
  -- insertar dos veces un mismo evento.

  INSERT INTO public.rc_external_delivery_events (
    inbox_id,
    restaurant_user_id,
    platform,
    external_event_id,
    event_type,
    payload,
    payload_sha256,
    processing_status,
    source_created_at
  )
  VALUES (
    p_inbox_id,
    p_restaurant_user_id,
    p_platform,
    p_external_event_id,
    p_event_type,
    p_payload,
    v_hash,
    'received',
    p_source_created_at
  )
  ON CONFLICT (
    restaurant_user_id,
    platform,
    external_event_id
  )
  DO NOTHING
  RETURNING id INTO v_new_id;

  IF v_new_id IS NOT NULL THEN
    event_id := v_new_id;
    result := 'created';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Verificar el evento previamente registrado.

  SELECT *
  INTO v_existing
  FROM public.rc_external_delivery_events
  WHERE restaurant_user_id = p_restaurant_user_id
    AND platform = p_platform
    AND external_event_id = p_external_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_CONFLICT_RETRY_LATER'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_existing.inbox_id IS DISTINCT FROM p_inbox_id
     OR v_existing.payload_sha256
        IS DISTINCT FROM v_hash
     OR v_existing.event_type
        IS DISTINCT FROM p_event_type
     OR v_existing.source_created_at
        IS DISTINCT FROM p_source_created_at
  THEN
    RAISE EXCEPTION 'EVENT_ID_REUSE_CONFLICT'
      USING ERRCODE = '23505';
  END IF;

  event_id := v_existing.id;
  result := 'duplicate';

  RETURN NEXT;

END;
$function$;

-- 3. PERMISOS

REVOKE ALL ON FUNCTION
public.rc_external_register_event(
  uuid, uuid, text, text, text, jsonb, timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_register_event(
  uuid, uuid, text, text, text, jsonb, timestamptz
)
TO service_role;

COMMIT;
