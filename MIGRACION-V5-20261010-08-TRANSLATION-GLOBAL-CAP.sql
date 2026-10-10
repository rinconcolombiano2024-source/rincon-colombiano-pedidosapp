-- V5-08: tope GLOBAL y limpieza acotada para la traducción pública (antes solo había cuota por IP+user-agent, falsificable).
-- Aditiva: no modifica rc_ordera_consume_translation_quota (v1). NO EJECUTADA: probar primero en staging.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$ BEGIN
  IF to_regclass('public.translation_request_limits') IS NULL THEN RAISE EXCEPTION 'Apply V86-04 first'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.translation_global_limits (
  window_start timestamptz PRIMARY KEY,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);
ALTER TABLE public.translation_global_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.translation_global_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.translation_global_limits TO service_role;
CREATE INDEX IF NOT EXISTS translation_request_limits_window_idx
  ON public.translation_request_limits (window_started_at);

CREATE OR REPLACE FUNCTION public.rc_ordera_consume_translation_quota_v2(
  p_client_hash text,
  p_hourly_limit integer DEFAULT 120,
  p_global_hourly_limit integer DEFAULT 2000,
  p_global_daily_limit integer DEFAULT 10000
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_client_limit integer := least(greatest(coalesce(p_hourly_limit, 120), 10), 500);
  v_hour_limit   integer := least(greatest(coalesce(p_global_hourly_limit, 2000), 100), 50000);
  v_day_limit    integer := least(greatest(coalesce(p_global_daily_limit, 10000), 100), 500000);
  v_bucket       timestamptz := date_trunc('hour', now());
  v_client_count integer;
  v_hour_count   integer;
  v_day_total    bigint;
BEGIN
  IF p_client_hash IS NULL OR p_client_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_CLIENT_HASH' USING ERRCODE = '22023';
  END IF;

  -- Limpieza acotada: la tabla no crece sin límite aunque se roten identidades.
  DELETE FROM public.translation_request_limits
   WHERE client_hash IN (SELECT client_hash FROM public.translation_request_limits
                          WHERE window_started_at < now() - interval '2 hours' LIMIT 200);
  DELETE FROM public.translation_global_limits WHERE window_start < now() - interval '2 days';

  -- Límite por cliente (misma semántica que v1).
  INSERT INTO public.translation_request_limits (client_hash, window_started_at, request_count, updated_at)
  VALUES (p_client_hash, now(), 1, now())
  ON CONFLICT (client_hash) DO UPDATE SET
    window_started_at = CASE WHEN translation_request_limits.window_started_at <= now() - interval '1 hour'
                             THEN now() ELSE translation_request_limits.window_started_at END,
    request_count = CASE WHEN translation_request_limits.window_started_at <= now() - interval '1 hour'
                         THEN 1 ELSE translation_request_limits.request_count + 1 END,
    updated_at = now()
  RETURNING request_count INTO v_client_count;
  IF v_client_count > v_client_limit THEN RETURN 'client_limit'; END IF;

  -- Tope diario global (ventana móvil de 24 h).
  SELECT coalesce(sum(request_count), 0) INTO v_day_total
    FROM public.translation_global_limits WHERE window_start >= now() - interval '24 hours';
  IF v_day_total >= v_day_limit THEN RETURN 'global_limit'; END IF;

  -- Tope horario global ATÓMICO: solo incrementa si queda cupo (UPSERT condicionado).
  INSERT INTO public.translation_global_limits (window_start, request_count)
  VALUES (v_bucket, 1)
  ON CONFLICT (window_start) DO UPDATE
    SET request_count = translation_global_limits.request_count + 1
    WHERE translation_global_limits.request_count < v_hour_limit
  RETURNING request_count INTO v_hour_count;
  IF v_hour_count IS NULL THEN RETURN 'global_limit'; END IF;

  RETURN 'ok';
END;
$body$;

REVOKE ALL ON FUNCTION public.rc_ordera_consume_translation_quota_v2(text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rc_ordera_consume_translation_quota_v2(text, integer, integer, integer)
  TO service_role;
COMMIT;
-- Recovery: la función y la tabla son aditivas; basta con volver a desplegar la Edge Function anterior (usa v1).
