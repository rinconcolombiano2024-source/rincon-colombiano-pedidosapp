
-- ======================================================
-- RC ORDERA V91-38
-- EXTERNAL DELIVERY EVENT JOURNAL
-- Auditoria persistente de eventos externos.
--
-- DEPENDENCIA: V91-36
-- INSTALAR PRIMERO EN STAGING
--
-- Sin cron, polling, triggers ni Realtime.
-- No modifica pedidos, pagos, cierres o fiscal.
-- ======================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- 1. Validar dependencia.

DO $preflight$
BEGIN
  IF to_regclass(
    'public.rc_external_delivery_inbox'
  ) IS NULL THEN
    RAISE EXCEPTION
      'V91-38 requires V91-36';
  END IF;
END;
$preflight$;

-- 2. Historial independiente.

CREATE TABLE IF NOT EXISTS
public.rc_external_delivery_events (

  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  inbox_id uuid NOT NULL
    REFERENCES public.rc_external_delivery_inbox(id)
    ON DELETE RESTRICT,

  restaurant_user_id uuid NOT NULL,

  platform text NOT NULL
    CHECK (
      platform ~ '^[a-z][a-z0-9_]{1,39}$'
    ),

  external_event_id text NOT NULL
    CHECK (
      length(external_event_id) BETWEEN 1 AND 160
    ),

  event_type text NOT NULL
    CHECK (
      length(event_type) BETWEEN 1 AND 80
    ),

  payload jsonb NOT NULL
    CHECK (
      jsonb_typeof(payload) = 'object'
      AND octet_length(payload::text) <= 65536
    ),

  payload_sha256 text NOT NULL
    CHECK (
      payload_sha256 ~ '^[0-9a-f]{64}$'
    ),

  processing_status text NOT NULL
    DEFAULT 'received'
    CHECK (
      processing_status IN (
        'received',
        'needs_review',
        'processed',
        'ignored',
        'failed'
      )
    ),

  source_created_at timestamptz,

  received_at timestamptz NOT NULL DEFAULT now(),

  processed_at timestamptz,

  CONSTRAINT rc_external_event_unique
    UNIQUE (
      restaurant_user_id,
      platform,
      external_event_id
    )
);

-- 3. Indices para consultas limitadas.

CREATE INDEX IF NOT EXISTS
rc_external_events_inbox_idx
ON public.rc_external_delivery_events (
  inbox_id,
  received_at DESC,
  id
);

CREATE INDEX IF NOT EXISTS
rc_external_events_pending_idx
ON public.rc_external_delivery_events (
  restaurant_user_id,
  received_at,
  id
)
WHERE processing_status IN (
  'received',
  'needs_review',
  'failed'
);

-- 4. Bloquear acceso directo del navegador.

ALTER TABLE public.rc_external_delivery_events
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON public.rc_external_delivery_events
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.rc_external_delivery_events
TO service_role;

COMMIT;
