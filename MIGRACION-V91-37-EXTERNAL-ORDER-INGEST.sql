-- RC ORDERA V91-37 - External order ingest, patched for Supabase pgcrypto in extensions
-- Depends on V91-36. TEST ON STAGING FIRST. No financial/fiscal side effects.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE v_missing text;
BEGIN
  IF to_regclass('public.rc_external_delivery_inbox') IS NULL THEN
    RAISE EXCEPTION 'V91-37 requires V91-36';
  END IF;
  SELECT string_agg(required.name, ', ') INTO v_missing
  FROM unnest(ARRAY['id','restaurant_user_id','platform','external_order_id',
    'source_status','processing_status','payload','payload_sha256','currency',
    'total_grosz','internal_order_id','received_at','updated_at']) AS required(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='rc_external_delivery_inbox'
      AND c.column_name=required.name
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'V91-37 missing columns: %',v_missing;
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.rc_external_ingest_order(
    p_restaurant_user_id uuid,
    p_platform text,
    p_external_order_id text,
    p_source_status text,
    p_payload jsonb,
    p_payload_sha256 text,
    p_currency text DEFAULT 'PLN',
    p_total_grosz bigint DEFAULT NULL
)
RETURNS TABLE(inbox_id uuid, ingest_result text, current_processing_status text)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_row public.rc_external_delivery_inbox%ROWTYPE;
    v_new_id uuid;
    v_platform text;
    v_external_id text;
    v_source_status text;
    v_currency text;
    v_actual_hash text;
BEGIN
    IF p_restaurant_user_id IS NULL THEN
        RAISE EXCEPTION 'RESTAURANT_REQUIRED' USING ERRCODE='22023';
    END IF;
    v_platform := p_platform;
    v_external_id := p_external_order_id;
    v_source_status := p_source_status;
    v_currency := p_currency;

    IF v_platform IS NULL OR v_platform !~ '^[a-z][a-z0-9_]{1,39}$' THEN
        RAISE EXCEPTION 'INVALID_PLATFORM' USING ERRCODE='22023';
    END IF;
    IF v_external_id IS NULL
       OR length(v_external_id) NOT BETWEEN 1 AND 160
       OR v_external_id <> btrim(v_external_id)
       OR v_external_id ~ '[[:cntrl:]]' THEN
        RAISE EXCEPTION 'INVALID_EXTERNAL_ID' USING ERRCODE='22023';
    END IF;
    IF v_source_status IS NULL
       OR length(v_source_status) NOT BETWEEN 1 AND 80
       OR v_source_status <> btrim(v_source_status)
       OR v_source_status ~ '[[:cntrl:]]' THEN
        RAISE EXCEPTION 'INVALID_SOURCE_STATUS' USING ERRCODE='22023';
    END IF;
    IF v_currency IS NULL OR v_currency !~ '^[A-Z]{3}$'
       OR (p_total_grosz IS NOT NULL AND p_total_grosz < 0) THEN
        RAISE EXCEPTION 'INVALID_MONEY' USING ERRCODE='22023';
    END IF;
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
       OR octet_length(p_payload::text) > 65536 THEN
        RAISE EXCEPTION 'INVALID_PAYLOAD' USING ERRCODE='22023';
    END IF;

    -- In this Supabase project, pgcrypto lives in extensions (not public).
    IF to_regprocedure('extensions.digest(bytea,text)') IS NULL THEN
        RAISE EXCEPTION 'PGCRYPTO_DIGEST_REQUIRED';
    END IF;
    v_actual_hash := encode(
        extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex'
    );
    IF p_payload_sha256 IS DISTINCT FROM v_actual_hash THEN
        RAISE EXCEPTION 'PAYLOAD_HASH_MISMATCH' USING ERRCODE='22023';
    END IF;

    INSERT INTO public.rc_external_delivery_inbox (
        restaurant_user_id,platform,external_order_id,source_status,
        processing_status,payload,payload_sha256,currency,total_grosz
    ) VALUES (
        p_restaurant_user_id,v_platform,v_external_id,v_source_status,
        'received',p_payload,v_actual_hash,v_currency,p_total_grosz
    )
    ON CONFLICT (restaurant_user_id,platform,external_order_id)
    DO NOTHING RETURNING id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
        inbox_id := v_new_id;
        ingest_result := 'created';
        current_processing_status := 'received';
        RETURN NEXT;
        RETURN;
    END IF;

    SELECT * INTO v_row
    FROM public.rc_external_delivery_inbox
    WHERE restaurant_user_id=p_restaurant_user_id
      AND platform=v_platform AND external_order_id=v_external_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INGEST_CONFLICT_RETRY_LATER' USING ERRCODE='P0001';
    END IF;
    inbox_id := v_row.id;
    IF v_row.payload_sha256=v_actual_hash
       AND v_row.source_status=v_source_status
       AND v_row.currency=v_currency
       AND v_row.total_grosz IS NOT DISTINCT FROM p_total_grosz THEN
        ingest_result := 'duplicate';
        current_processing_status := v_row.processing_status;
        RETURN NEXT;
        RETURN;
    END IF;

    IF v_row.processing_status IN ('imported','cancelled')
       OR v_row.internal_order_id IS NOT NULL THEN
        ingest_result := 'reconciliation_required';
        current_processing_status := v_row.processing_status;
        RETURN NEXT;
        RETURN;
    END IF;

    UPDATE public.rc_external_delivery_inbox
    SET processing_status='needs_review',source_status=v_source_status,
        payload=p_payload,payload_sha256=v_actual_hash,currency=v_currency,
        total_grosz=p_total_grosz,updated_at=clock_timestamp()
    WHERE id=v_row.id AND processing_status IN ('received','needs_review');

    ingest_result := 'updated_needs_review';
    current_processing_status := 'needs_review';
    RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.rc_external_ingest_order(
    uuid,text,text,text,jsonb,text,text,bigint
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rc_external_ingest_order(
    uuid,text,text,text,jsonb,text,text,bigint
) TO service_role;
COMMIT;
