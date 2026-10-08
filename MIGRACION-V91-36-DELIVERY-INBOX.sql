
-- =====================================================
-- RC ORDERA V91-36
-- EXTERNAL DELIVERY INBOX
-- Version 1.0 - staging
--
-- No altera pedidos, pagos, cierres ni POS.
-- No crea cron, triggers ni Realtime.
-- No realiza solicitudes HTTP.
-- =====================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS
public.rc_external_delivery_inbox (

  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  restaurant_user_id uuid NOT NULL,

  platform text NOT NULL
    CHECK (
      platform ~ '^[a-z][a-z0-9_]{1,39}$'
    ),

  external_order_id text NOT NULL
    CHECK (
      length(external_order_id) BETWEEN 1 AND 160
      AND external_order_id = btrim(external_order_id)
      AND external_order_id !~ '[[:cntrl:]]'
    ),

  source_status text NOT NULL DEFAULT 'new',

  processing_status text NOT NULL DEFAULT 'received'
    CHECK (
      processing_status IN (
        'received',
        'needs_review',
        'imported',
        'cancelled'
      )
    ),

  payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (
      jsonb_typeof(payload) = 'object'
      AND octet_length(payload::text) <= 65536
    ),

  payload_sha256 text NOT NULL
    CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),

  currency text NOT NULL DEFAULT 'PLN'
    CHECK (currency ~ '^[A-Z]{3}$'),

  total_grosz bigint
    CHECK (total_grosz >= 0),

  internal_order_id uuid,

  source_created_at timestamptz,

  received_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rc_external_delivery_unique
    UNIQUE (
      restaurant_user_id,
      platform,
      external_order_id
    ),

  CONSTRAINT rc_external_internal_unique
    UNIQUE (internal_order_id)
);

-- Indice para bandeja de pedidos pendientes.
-- Filtra por restaurante y estado.
CREATE INDEX IF NOT EXISTS
rc_external_delivery_queue_idx
ON public.rc_external_delivery_inbox (
  restaurant_user_id,
  processing_status,
  received_at,
  id
);

-- Proteccion de acceso.
ALTER TABLE public.rc_external_delivery_inbox
ENABLE ROW LEVEL SECURITY;

-- No se permite acceso directo al navegador.
REVOKE ALL
ON public.rc_external_delivery_inbox
FROM PUBLIC, anon, authenticated;

-- Acceso exclusivo del backend confiable.
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.rc_external_delivery_inbox
TO service_role;

COMMIT;
