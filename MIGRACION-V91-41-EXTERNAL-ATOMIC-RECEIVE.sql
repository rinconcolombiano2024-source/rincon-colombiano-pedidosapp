
-- ==========================================================
-- RC ORDERA V91-41
-- ATOMIC EXTERNAL ORDER + EVENT
--
-- Requires V91-36 through V91-40.
-- STAGING FIRST.
-- Service-role only.
-- No cron, triggers, polling, financial or fiscal writes.
-- ==========================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- 1. Strict dependency checks

DO $preflight$
BEGIN
  IF to_regclass(
    'public.rc_external_delivery_inbox'
  ) IS NULL OR to_regclass(
    'public.rc_external_delivery_events'
  ) IS NULL THEN
    RAISE EXCEPTION 'EXTERNAL_TABLES_MISSING';
  END IF;

  IF to_regprocedure(
    'public.rc_external_ingest_order(uuid,text,text,text,jsonb,text,text,bigint)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_37_REQUIRED';
  END IF;

  IF to_regprocedure(
    'public.rc_external_register_event(uuid,uuid,text,text,text,jsonb,timestamptz)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_39_REQUIRED';
  END IF;

  IF to_regprocedure(
    'extensions.digest(bytea,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'PGCRYPTO_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'public.rc_external_delivery_events'::regclass
      AND conname = 'rc_external_event_tenant_fk'
      AND contype = 'f'
      AND convalidated
  ) THEN
    RAISE EXCEPTION 'V91_40_REQUIRED';
  END IF;
END;
$preflight$;

-- 2. Transactional event ingestion

CREATE OR REPLACE FUNCTION
public.rc_external_receive_atomic(
  p_restaurant_user_id uuid,
  p_platform text,
  p_external_order_id text,
  p_external_event_id text,
  p_event_type text,
  p_source_status text,
  p_payload jsonb,
  p_currency text DEFAULT 'PLN',
  p_total_grosz bigint DEFAULT NULL,
  p_source_created_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  inbox_id uuid,
  event_id uuid,
  order_result text,
  event_result text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_hash text;
  v_inbox_id uuid;
  v_event_id uuid;
  v_order_result text;
  v_event_result text;
BEGIN

  -- Validate payload before processing.
  IF p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object'
     OR octet_length(p_payload::text) > 65536
  THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD'
      USING ERRCODE = '22023';
  END IF;

  -- Same canonical JSONB representation
  -- expected by V91-37.
  v_hash := encode(
    extensions.digest(
      convert_to(p_payload::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  -- Existing V91-37 ingestion.
  SELECT i.inbox_id, i.ingest_result
  INTO STRICT v_inbox_id, v_order_result
  FROM public.rc_external_ingest_order(
    p_restaurant_user_id,
    p_platform,
    p_external_order_id,
    p_source_status,
    p_payload,
    v_hash,
    p_currency,
    p_total_grosz
  ) AS i;

  -- Existing V91-39 event registration.
  SELECT e.event_id, e.result
  INTO STRICT v_event_id, v_event_result
  FROM public.rc_external_register_event(
    v_inbox_id,
    p_restaurant_user_id,
    p_platform,
    p_external_event_id,
    p_event_type,
    p_payload,
    p_source_created_at
  ) AS e;

  -- Both functions execute within
  -- the same PostgreSQL transaction.
  -- Any exception rolls back both writes.

  inbox_id := v_inbox_id;
  event_id := v_event_id;
  order_result := v_order_result;
  event_result := v_event_result;

  RETURN NEXT;
END;
$function$;

-- 3. Block direct public execution.

REVOKE ALL ON FUNCTION
public.rc_external_receive_atomic(
  uuid,text,text,text,text,text,jsonb,
  text,bigint,timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_external_receive_atomic(
  uuid,text,text,text,text,text,jsonb,
  text,bigint,timestamptz
)
TO service_role;

COMMIT;
