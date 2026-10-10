-- ============================================================
-- RC ORDERA V5-20261010-01 — Resultado fiscal y token por dispositivo
-- NO EJECUTADA EN PRODUCCIÓN: probar primero en un proyecto Supabase de staging.
-- Mantiene la regla actual: solo dispositivos con environment = 'test'.
-- Pasar un dispositivo a 'production' requiere una migración separada y certificación.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
 IF to_regprocedure('public.rc_fiscal_claim_next(uuid,uuid,text)') IS NULL THEN RAISE EXCEPTION 'Apply V91-34 and V91-35 first'; END IF;
END $$;
ALTER TABLE public.fiscal_devices ADD COLUMN IF NOT EXISTS driver_id text NOT NULL DEFAULT 'mock';

ALTER TABLE public.fiscal_devices
    ADD COLUMN IF NOT EXISTS agent_token_hash text;

ALTER TABLE public.fiscal_devices
    DROP CONSTRAINT IF EXISTS fiscal_devices_agent_token_hash_chk;
ALTER TABLE public.fiscal_devices
    ADD CONSTRAINT fiscal_devices_agent_token_hash_chk
    CHECK (agent_token_hash IS NULL OR agent_token_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION
public.rc_fiscal_record_result(
    p_operation_id uuid,
    p_device_id uuid,
    p_claim_token_hash text,
    p_outcome text,
    p_result jsonb DEFAULT '{}'::jsonb
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
       OR p_outcome IS NULL
       OR p_outcome NOT IN ('confirmed', 'failed', 'unknown')
       OR p_result IS NULL
       OR jsonb_typeof(p_result) <> 'object'
       OR pg_column_size(p_result) > 8192
    THEN
        RAISE EXCEPTION 'INVALID_RESULT_PARAMETERS'
            USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_operation
    FROM public.fiscal_operations
    WHERE id = p_operation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'OPERATION_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_operation.device_id IS DISTINCT FROM p_device_id
       OR v_operation.claim_token_hash IS DISTINCT FROM p_claim_token_hash
    THEN
        RAISE EXCEPTION 'CLAIM_TOKEN_MISMATCH' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.fiscal_devices fd
        WHERE fd.id = p_device_id AND fd.restaurant_user_id = v_operation.restaurant_user_id
          AND fd.enabled IS TRUE AND fd.environment = 'test' AND fd.driver_id = 'mock'
    ) THEN RAISE EXCEPTION 'DEVICE_NOT_AUTHORIZED' USING ERRCODE = '42501'; END IF;
    IF p_outcome = 'confirmed' AND (p_result->>'simulated' IS DISTINCT FROM 'true' OR p_result->>'fiscal' IS DISTINCT FROM 'false') THEN
        RAISE EXCEPTION 'MOCK_CANNOT_CONFIRM_REAL_FISCAL_RECEIPT' USING ERRCODE = '22023';
    END IF;
    -- A lost response to result() is safe to retry with the same token and exact result.
    IF v_operation.state = p_outcome AND EXISTS (
        SELECT 1 FROM public.fiscal_events WHERE operation_id=p_operation_id
          AND event_type='result_recorded' AND next_state=p_outcome
          AND event_data->'result'=p_result
    ) THEN RETURN TRUE; END IF;
    IF NOT ((v_operation.state='sending' AND p_outcome IN ('confirmed','unknown','failed'))
         OR (v_operation.state='unknown' AND p_outcome IN ('confirmed','failed'))) THEN
        RAISE EXCEPTION 'INVALID_FISCAL_STATE' USING ERRCODE = '55000';
    END IF;

    UPDATE public.fiscal_operations
    SET state = p_outcome, updated_at = clock_timestamp()
    WHERE id = p_operation_id
      AND state = v_operation.state;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESULT_CONFLICT' USING ERRCODE = '40001';
    END IF;

    INSERT INTO public.fiscal_events (
        operation_id, event_type, previous_state, next_state, event_data
    )
    VALUES (
        p_operation_id, 'result_recorded', v_operation.state, p_outcome,
        jsonb_build_object('device_id', p_device_id, 'result', p_result)
    );

    RETURN TRUE;
END;
$body$;

REVOKE ALL ON FUNCTION public.rc_fiscal_record_result(uuid, uuid, text, text, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rc_fiscal_record_result(uuid, uuid, text, text, jsonb)
TO service_role;

COMMIT;

-- Postcondition: token authenticated only by gateway; RLS remains closed to anon/authenticated.
SELECT NOT has_function_privilege('anon','public.rc_fiscal_record_result(uuid,uuid,text,text,jsonb)','EXECUTE') AS anon_blocked;
-- Recovery: disable RC_FISCAL_AGENT_ENABLED, preserve operations and events; do not reset UNKNOWN to pending.
