-- V5-09 / consolidated V6: transaction-safe paid translation budget.
-- Preserve V5-08 unchanged. Apply only in staging first; no automatic application.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF to_regclass('public.translation_global_limits') IS NULL OR to_regclass('public.translation_request_limits') IS NULL
 THEN RAISE EXCEPTION 'Apply V86-04 and V5-08 first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rc_ordera_consume_translation_quota_v2(text,integer,integer,integer)') AND md5(prosrc) IN ('14254830bf0df8ce08854ea8b2e656d7','83a34d4ea917c56cf5cac951c748d7b2'))
 THEN RAISE EXCEPTION 'Unexpected quota v2 body: review drift before applying V5-09'; END IF;
 IF EXISTS(SELECT 1 FROM public.translation_global_limits WHERE window_start<>date_trunc('hour',window_start,'UTC'))
 THEN RAISE EXCEPTION 'Non-UTC hour buckets: reconcile counters before V5-09'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.rc_ordera_consume_translation_quota_v2(
 p_client_hash text,p_hourly_limit integer DEFAULT 120,
 p_global_hourly_limit integer DEFAULT 2000,p_global_daily_limit integer DEFAULT 10000
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $body$
DECLARE
  v_client_limit integer := least(greatest(coalesce(p_hourly_limit,120),10),500);
  v_hour_limit integer := least(greatest(coalesce(p_global_hourly_limit,2000),100),50000);
  v_day_limit integer := least(greatest(coalesce(p_global_daily_limit,10000),100),500000);
  v_bucket timestamptz := date_trunc('hour',now(),'UTC');
  v_count integer;
  v_total bigint;
BEGIN
  IF p_client_hash IS NULL OR p_client_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_CLIENT_HASH' USING ERRCODE='22023';
  END IF;
  -- One transaction lock across instances: daily read and hourly write share a fence.
  -- No external HTTP is performed while this lock is held.
  PERFORM pg_advisory_xact_lock(70900109::bigint);
  WITH expired AS MATERIALIZED (
    SELECT client_hash FROM public.translation_request_limits
    WHERE window_started_at < now()-interval '2 hours'
    ORDER BY window_started_at,client_hash LIMIT 200 FOR UPDATE SKIP LOCKED
  ) DELETE FROM public.translation_request_limits t USING expired e WHERE t.client_hash=e.client_hash;
  WITH expired AS MATERIALIZED (
    SELECT window_start FROM public.translation_global_limits
    WHERE window_start < now()-interval '2 days'
    ORDER BY window_start LIMIT 72 FOR UPDATE SKIP LOCKED
  ) DELETE FROM public.translation_global_limits t USING expired e WHERE t.window_start=e.window_start;
  -- Conservative rolling 24h: include the whole oldest partial hour (at most 25 buckets).
  SELECT coalesce(sum(request_count),0) INTO v_total FROM public.translation_global_limits
    WHERE window_start >= date_trunc('hour',now()-interval '24 hours','UTC');
  IF v_total >= v_day_limit THEN RETURN 'global_limit'; END IF;
  SELECT coalesce(sum(request_count),0) INTO v_total FROM public.translation_global_limits
    WHERE window_start >= v_bucket;
  IF v_total >= v_hour_limit THEN RETURN 'global_limit'; END IF;
  -- Denial does not create rotating client identities or increment exhausted counters.
  INSERT INTO public.translation_request_limits(client_hash,window_started_at,request_count,updated_at)
  VALUES(p_client_hash,now(),1,now())
  ON CONFLICT(client_hash) DO UPDATE SET
    window_started_at=CASE WHEN translation_request_limits.window_started_at <= now()-interval '1 hour' THEN now() ELSE translation_request_limits.window_started_at END,
    request_count=CASE WHEN translation_request_limits.window_started_at <= now()-interval '1 hour' THEN 1 ELSE translation_request_limits.request_count+1 END,
    updated_at=now()
  WHERE translation_request_limits.window_started_at <= now()-interval '1 hour'
     OR translation_request_limits.request_count < v_client_limit
  RETURNING request_count INTO v_count;
  IF v_count IS NULL THEN RETURN 'client_limit'; END IF;
  INSERT INTO public.translation_global_limits(window_start,request_count) VALUES(v_bucket,1)
  ON CONFLICT(window_start) DO UPDATE SET request_count=translation_global_limits.request_count+1;
  RETURN 'ok';
END;
$body$;
REVOKE ALL ON FUNCTION public.rc_ordera_consume_translation_quota_v2(text,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rc_ordera_consume_translation_quota_v2(text,integer,integer,integer) TO service_role;
DO $$ BEGIN
 IF has_function_privilege('anon','public.rc_ordera_consume_translation_quota_v2(text,integer,integer,integer)','EXECUTE')
 OR has_function_privilege('authenticated','public.rc_ordera_consume_translation_quota_v2(text,integer,integer,integer)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.rc_ordera_consume_translation_quota_v2(text,integer,integer,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'Unexpected translation quota privileges'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
-- Recovery: disable the paid translation endpoint; retain cache and counters.
-- Do not restore v1/08 automatically: they lack this budget fence. Reconcile and roll forward.
