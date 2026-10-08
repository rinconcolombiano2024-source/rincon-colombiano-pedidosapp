
-- ============================================================
-- RC ORDERA V91-35
-- FISCAL CLAIM - HARDENED
--
-- Requiere V91-34 instalada y validada.
-- STAGING FIRST / NO REAL FISCAL PRINTING
--
-- No modifica pedidos, ventas ni cierres.
-- Falla y revierte si faltan dependencias.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ============================================================
-- 1. PREFLIGHT
-- ============================================================

DO $preflight$
DECLARE
    v_required text;
BEGIN

    FOREACH v_required IN ARRAY ARRAY[
        'public.fiscal_devices',
        'public.fiscal_operations',
        'public.fiscal_events'
    ]
    LOOP
        IF to_regclass(v_required) IS NULL THEN
            RAISE EXCEPTION
                'DEPENDENCY_MISSING: % - install V91-34 first',
                v_required;
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM (
            VALUES
              ('fiscal_devices','id'),
              ('fiscal_devices','restaurant_user_id'),
              ('fiscal_devices','enabled'),
              ('fiscal_devices','environment'),
              ('fiscal_operations','id'),
              ('fiscal_operations','restaurant_user_id'),
              ('fiscal_operations','device_id'),
              ('fiscal_operations','state'),
              ('fiscal_operations','operation_type'),
              ('fiscal_operations','payload'),
              ('fiscal_operations','created_at'),
              ('fiscal_operations','updated_at'),
              ('fiscal_operations','claim_token_hash'),
              ('fiscal_operations','claim_expires_at'),
              ('fiscal_events','operation_id'),
              ('fiscal_events','event_type'),
              ('fiscal_events','previous_state'),
              ('fiscal_events','next_state'),
              ('fiscal_events','event_data')
        ) AS required(table_name, column_name)
        WHERE NOT EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = required.table_name
              AND c.column_name = required.column_name
        )
    ) THEN
        RAISE EXCEPTION
            'INCOMPATIBLE_SCHEMA: required fiscal columns missing';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'fiscal_operations'
          AND column_name = 'claim_expires_at'
          AND data_type <> 'timestamp with time zone'
    ) THEN
        RAISE EXCEPTION
            'INVALID_SCHEMA: claim_expires_at must be timestamptz';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'fiscal_operations'
          AND column_name = 'claim_token_hash'
          AND data_type <> 'text'
    ) THEN
        RAISE EXCEPTION
            'INVALID_SCHEMA: claim_token_hash must be text';
    END IF;

END;
$preflight$;

-- ============================================================
-- 2. ONE ACTIVE OPERATION PER DEVICE
-- ============================================================

-- UNKNOWN permanece bloqueante.
-- Nunca reutilizar automaticamente una impresora
-- con resultado fiscal sin conciliar.

CREATE UNIQUE INDEX IF NOT EXISTS
    fiscal_device_one_active_operation_idx
ON public.fiscal_operations(device_id)
WHERE device_id IS NOT NULL
  AND state IN ('claimed', 'sending', 'unknown');

-- ============================================================
-- 3. ATOMIC CLAIM
-- ============================================================

CREATE OR REPLACE FUNCTION
public.rc_fiscal_claim_next(
    p_restaurant_user_id uuid,
    p_device_id uuid,
    p_claim_token_hash text
)
RETURNS TABLE(
    operation_id uuid,
    claim_expires_at timestamptz,
    fiscal_payload jsonb
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $body$
DECLARE
    v_operation_id uuid;
    v_payload jsonb;
    v_expiration timestamptz;
BEGIN

    IF p_restaurant_user_id IS NULL
       OR p_device_id IS NULL
       OR p_claim_token_hash IS NULL
       OR p_claim_token_hash !~ '^[0-9a-f]{64}$'
    THEN
        RAISE EXCEPTION 'INVALID_CLAIM_PARAMETERS'
            USING ERRCODE = '22023';
    END IF;

    -- Serializar asignaciones por dispositivo.
    PERFORM 1
    FROM public.fiscal_devices fd
    WHERE fd.id = p_device_id
      AND fd.restaurant_user_id = p_restaurant_user_id
      AND fd.enabled IS TRUE
      AND fd.environment = 'test'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'DEVICE_NOT_AUTHORIZED'
            USING ERRCODE = '42501';
    END IF;

    -- Un estado UNKNOWN sigue bloqueando el equipo.
    IF EXISTS (
        SELECT 1
        FROM public.fiscal_operations fo
        WHERE fo.device_id = p_device_id
          AND fo.state IN (
              'claimed',
              'sending',
              'unknown'
          )
    ) THEN
        RETURN;
    END IF;

    -- Bloqueo de fila y seleccion FIFO.
    SELECT fo.id, fo.payload
    INTO v_operation_id, v_payload
    FROM public.fiscal_operations fo
    WHERE fo.restaurant_user_id =
          p_restaurant_user_id
      AND fo.state = 'pending'
      AND fo.device_id IS NULL
      AND fo.operation_type = 'sale'
    ORDER BY fo.created_at, fo.id
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_operation_id IS NULL THEN
        RETURN;
    END IF;

    IF v_payload IS NULL
       OR jsonb_typeof(v_payload) <> 'object'
    THEN
        RAISE EXCEPTION 'INVALID_FISCAL_PAYLOAD'
            USING ERRCODE = '22023';
    END IF;

    v_expiration :=
        clock_timestamp() + interval '2 minutes';

    UPDATE public.fiscal_operations fo
    SET
        state = 'claimed',
        device_id = p_device_id,
        claim_token_hash = p_claim_token_hash,
        claim_expires_at = v_expiration,
        updated_at = clock_timestamp()
    WHERE fo.id = v_operation_id
      AND fo.restaurant_user_id =
          p_restaurant_user_id
      AND fo.state = 'pending'
      AND fo.device_id IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CLAIM_CONFLICT'
            USING ERRCODE = '40001';
    END IF;

    INSERT INTO public.fiscal_events (
        operation_id,
        event_type,
        previous_state,
        next_state,
        event_data
    )
    VALUES (
        v_operation_id,
        'claim_created',
        'pending',
        'claimed',
        jsonb_build_object(
            'device_id', p_device_id,
            'environment', 'test'
        )
    );

    operation_id := v_operation_id;
    claim_expires_at := v_expiration;
    fiscal_payload := v_payload;

    RETURN NEXT;
END;
$body$;

-- ============================================================
-- 4. MARK SENDING
-- ============================================================

CREATE OR REPLACE FUNCTION
public.rc_fiscal_mark_sending(
    p_operation_id uuid,
    p_device_id uuid,
    p_claim_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $body$
DECLARE
    v_operation public.fiscal_operations%ROWTYPE;
BEGIN

    IF p_operation_id IS NULL
       OR p_device_id IS NULL
       OR p_claim_token_hash IS NULL
       OR p_claim_token_hash !~ '^[0-9a-f]{64}$'
    THEN
        RAISE EXCEPTION 'INVALID_SENDING_PARAMETERS'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_operation
    FROM public.fiscal_operations
    WHERE id = p_operation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'OPERATION_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_operation.device_id IS DISTINCT FROM
       p_device_id
       OR v_operation.claim_token_hash IS DISTINCT FROM
       p_claim_token_hash
    THEN
        RAISE EXCEPTION 'CLAIM_TOKEN_MISMATCH'
            USING ERRCODE = '42501';
    END IF;

    IF v_operation.state <> 'claimed' THEN
        RAISE EXCEPTION 'INVALID_FISCAL_STATE'
            USING ERRCODE = '55000';
    END IF;

    IF v_operation.claim_expires_at IS NULL
       OR v_operation.claim_expires_at <=
          clock_timestamp()
    THEN
        RAISE EXCEPTION 'CLAIM_EXPIRED'
            USING ERRCODE = '55000';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.fiscal_devices fd
        WHERE fd.id = p_device_id
          AND fd.restaurant_user_id =
              v_operation.restaurant_user_id
          AND fd.enabled IS TRUE
          AND fd.environment = 'test'
    ) THEN
        RAISE EXCEPTION 'DEVICE_NOT_AUTHORIZED'
            USING ERRCODE = '42501';
    END IF;

    -- Registrar antes de transmitir.
    UPDATE public.fiscal_operations
    SET
        state = 'sending',
        updated_at = clock_timestamp()
    WHERE id = p_operation_id
      AND state = 'claimed';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SENDING_CONFLICT'
            USING ERRCODE = '40001';
    END IF;

    INSERT INTO public.fiscal_events (
        operation_id,
        event_type,
        previous_state,
        next_state,
        event_data
    )
    VALUES (
        p_operation_id,
        'transmission_started',
        'claimed',
        'sending',
        jsonb_build_object(
            'device_id', p_device_id,
            'environment', 'test'
        )
    );

    RETURN TRUE;
END;
$body$;

-- ============================================================
-- 5. RPC ACCESS CONTROL
-- ============================================================

REVOKE ALL ON FUNCTION
public.rc_fiscal_claim_next(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
public.rc_fiscal_mark_sending(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_fiscal_claim_next(uuid, uuid, text)
TO service_role;

GRANT EXECUTE ON FUNCTION
public.rc_fiscal_mark_sending(uuid, uuid, text)
TO service_role;

COMMIT;
