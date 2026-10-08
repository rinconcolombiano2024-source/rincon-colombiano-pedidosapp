
-- RC ORDERA V91-34
-- BASE FISCAL SEGURA
-- SOLO STAGING
-- No modifica tablas de pedidos existentes.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public.fiscal_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_user_id uuid NOT NULL,
    device_name text NOT NULL,
    serial_number text,
    environment text NOT NULL DEFAULT 'test'
        CHECK (environment IN ('test', 'production')),
    enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fiscal_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_user_id uuid NOT NULL,
    device_id uuid REFERENCES public.fiscal_devices(id),
    order_id uuid,
    operation_type text NOT NULL DEFAULT 'sale'
        CHECK (operation_type IN ('sale')),
    state text NOT NULL DEFAULT 'pending'
        CHECK (state IN (
            'pending',
            'claimed',
            'sending',
            'confirmed',
            'unknown',
            'failed',
            'cancelled'
        )),
    payload jsonb NOT NULL
        CHECK (jsonb_typeof(payload) = 'object'),
    claim_token_hash text,
    claim_expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fiscal_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id uuid NOT NULL
        REFERENCES public.fiscal_operations(id),
    event_type text NOT NULL,
    previous_state text,
    next_state text,
    event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS
    fiscal_sale_order_unique_idx
ON public.fiscal_operations (
    restaurant_user_id, order_id
)
WHERE operation_type = 'sale'
  AND order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
    fiscal_operations_queue_idx
ON public.fiscal_operations (
    restaurant_user_id, state, created_at
);

CREATE INDEX IF NOT EXISTS
    fiscal_events_operation_idx
ON public.fiscal_events (
    operation_id, created_at
);

ALTER TABLE public.fiscal_devices
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fiscal_operations
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fiscal_events
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fiscal_devices
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.fiscal_operations
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.fiscal_events
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.fiscal_devices,
   public.fiscal_operations,
   public.fiscal_events
TO service_role;

COMMIT;
