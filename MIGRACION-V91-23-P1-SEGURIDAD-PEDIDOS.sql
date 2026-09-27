-- ============================================================
-- RC ORDERA - V91-23
-- P1 SECURITY: anti-abuse para create_customer_order
--
-- Requisitos:
--   1) Aplicar DESPUES de V91-22.
--   2) Recomendado: desplegar primero el cliente que envia clientGuardId.
--      Clientes antiguos siguen funcionando por el circuit breaker global.
--
-- Objetivo:
--   - Evitar creacion anonima ilimitada de pedidos con UUID nuevos.
--   - Mantener idempotencia.
--   - No modificar precios, menu, delivery ni contratos de respuesta.
--   - No almacenar clientGuardId dentro del pedido.
-- ============================================================

BEGIN;

-- 1) Verificar que estamos envolviendo exactamente el contrato V91-22.
DO $contract$
DECLARE
  v_fn regprocedure;
  v_def text;
BEGIN
  IF to_regprocedure(
    'public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'V91-23 already appears to be installed';
  END IF;

  v_fn := to_regprocedure(
    'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)'
  );

  IF v_fn IS NULL THEN
    RAISE EXCEPTION 'CONTRACT ERROR: create_customer_order not found';
  END IF;

  SELECT pg_get_functiondef(v_fn::oid) INTO v_def;

  IF position('v_menu_lookup_v22' in coalesce(v_def, '')) = 0 THEN
    RAISE EXCEPTION 'CONTRACT ERROR: expected V91-22 create_customer_order';
  END IF;
END
$contract$;

-- 2) Tabla privada de buckets. No contiene IP, token ni guard en claro.
CREATE TABLE IF NOT EXISTS public.customer_order_rate_limit_buckets (
  restaurant_user_id uuid NOT NULL,
  scope text NOT NULL,
  subject_hash text NOT NULL,
  bucket_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_user_id, scope, subject_hash, bucket_start)
);

ALTER TABLE public.customer_order_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_order_rate_limit_buckets FROM PUBLIC, anon, authenticated;

-- 3) Consumidor atomico de cuota.
CREATE OR REPLACE FUNCTION public.rc_ordera_consume_order_rate_limit(
  p_restaurant_user_id uuid,
  p_scope text,
  p_subject text,
  p_window interval,
  p_limit integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_bucket_start timestamptz;
  v_subject_hash text;
  v_hits integer;
BEGIN
  IF p_restaurant_user_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant is required';
  END IF;

  IF p_window IS NULL OR p_window <= interval '0 seconds' THEN
    RAISE EXCEPTION 'Invalid rate-limit window';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'Invalid rate-limit value';
  END IF;

  v_bucket_start := date_bin(
    p_window,
    clock_timestamp(),
    timestamptz '2000-01-01 00:00:00+00'
  );

  v_subject_hash := encode(
    digest(coalesce(p_subject, ''), 'sha256'),
    'hex'
  );

  INSERT INTO public.customer_order_rate_limit_buckets (
    restaurant_user_id,
    scope,
    subject_hash,
    bucket_start,
    hits,
    updated_at
  ) VALUES (
    p_restaurant_user_id,
    left(coalesce(p_scope, ''), 80),
    v_subject_hash,
    v_bucket_start,
    1,
    clock_timestamp()
  )
  ON CONFLICT (restaurant_user_id, scope, subject_hash, bucket_start)
  DO UPDATE SET
    hits = public.customer_order_rate_limit_buckets.hits + 1,
    updated_at = clock_timestamp()
  RETURNING hits INTO v_hits;

  IF v_hits > p_limit THEN
    RAISE EXCEPTION 'ORDER_RATE_LIMITED'
      USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.rc_ordera_consume_order_rate_limit(uuid,text,text,interval,integer)
  FROM PUBLIC, anon, authenticated;

-- 4) Renombrar la funcion V91-22 real y cerrarla al exterior.
ALTER FUNCTION public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)
  RENAME TO create_customer_order_v91_22_core;

REVOKE ALL ON FUNCTION public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)
  FROM PUBLIC, anon, authenticated;

-- 5) Wrapper publico con limitacion ANTES del trabajo pesado de V91-22.
CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_id uuid,
  p_user_id uuid,
  p_public_token text,
  p_table_label text,
  p_customer_name text,
  p_order_type text,
  p_order_json jsonb,
  p_total numeric
)
RETURNS TABLE(
  id uuid,
  public_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_guard text := lower(trim(coalesce(p_order_json->>'clientGuardId', '')));
  v_clean_order_json jsonb := coalesce(p_order_json, '{}'::jsonb)
    - 'clientGuardId'
    - 'client_guard_id';
  v_is_idempotent_retry boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant is required';
  END IF;

  -- Un reintento legitimo del mismo pedido no consume cuota otra vez.
  IF p_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.customer_orders co
      WHERE co.id = p_id
        AND co.user_id = p_user_id
        AND public.rc_ordera_customer_token_matches(co.id, p_public_token)
        AND co.customer_user_id IS NOT DISTINCT FROM v_auth_uid
    ) INTO v_is_idempotent_retry;
  END IF;

  IF NOT v_is_idempotent_retry THEN
    IF v_auth_uid IS NULL THEN
      -- El guard NO es una credencial. Solo estabiliza el rate limit por navegador.
      -- Se mantiene compatibilidad con clientes PWA antiguos: si aun no envian guard,
      -- se aplica de todos modos el circuit breaker global del restaurante.
      IF v_guard ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        -- Por navegador/invitado: bloquea clicks repetidos y automatizacion simple.
        PERFORM public.rc_ordera_consume_order_rate_limit(
          p_user_id, 'anon_guard_10m', v_guard, interval '10 minutes', 4
        );
        PERFORM public.rc_ordera_consume_order_rate_limit(
          p_user_id, 'anon_guard_1h', v_guard, interval '1 hour', 12
        );
      END IF;

      -- Circuit breaker por restaurante: evita UUID/guard infinitos.
      PERFORM public.rc_ordera_consume_order_rate_limit(
        p_user_id, 'anon_restaurant_5m', 'all-anonymous', interval '5 minutes', 30
      );
      PERFORM public.rc_ordera_consume_order_rate_limit(
        p_user_id, 'anon_restaurant_1h', 'all-anonymous', interval '1 hour', 120
      );
    ELSE
      -- Clientes autenticados tambien tienen una cuota razonable por cuenta.
      PERFORM public.rc_ordera_consume_order_rate_limit(
        p_user_id, 'auth_user_10m', v_auth_uid::text, interval '10 minutes', 6
      );
      PERFORM public.rc_ordera_consume_order_rate_limit(
        p_user_id, 'auth_user_1h', v_auth_uid::text, interval '1 hour', 20
      );
    END IF;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.create_customer_order_v91_22_core(
    p_id,
    p_user_id,
    p_public_token,
    p_table_label,
    p_customer_name,
    p_order_type,
    v_clean_order_json,
    p_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)
  TO anon, authenticated;

-- 6) Postchecks: el core nunca puede quedar invocable directamente por cliente.
DO $postcheck$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'SECURITY ERROR: anon can bypass rate limiter';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'SECURITY ERROR: authenticated can bypass rate limiter';
  END IF;

  IF NOT has_function_privilege(
    'anon',
    'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'SECURITY ERROR: anon cannot call protected wrapper';
  END IF;
END
$postcheck$;

COMMIT;

-- Opcional de mantenimiento (ejecutar periodicamente, no es requisito del deploy):
-- delete from public.customer_order_rate_limit_buckets
-- where bucket_start < now() - interval '7 days';
