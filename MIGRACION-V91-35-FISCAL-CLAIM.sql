
-- =====================================================
-- RC ORDERA V91-35
-- FISCAL CLAIM & SENDING SECURITY
--
-- REQUIERE V91-34.
-- EJECUTAR SOLO EN STAGING.
-- NO REALIZA IMPRESION FISCAL.
-- NO ALTERA PEDIDOS EXISTENTES.
-- =====================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- =====================================================
-- 1. PREFLIGHT ESTRICTO
-- =====================================================

DO $preflight$
BEGIN
  IF to_regclass('public.fiscal_devices') IS NULL
    OR to_regclass('public.fiscal_operations') IS NULL
    OR to_regclass('public.fiscal_events') IS NULL
  THEN
    RAISE EXCEPTION
      'V91-34 required: fiscal tables missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fiscal_operations'
      AND column_name = 'claim_token_hash'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION
      'Incompatible fiscal_operations schema';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fiscal_operations'
      AND column_name = 'claim_expires_at'
      AND data_type = 'timestamp with time zone'
  ) THEN
    RAISE EXCEPTION
      'Claim expiration column missing';
  END IF;
END;
$preflight$;

-- =====================================================
-- 2. UNA OPERACION ACTIVA POR DISPOSITIVO
-- =====================================================

-- El estado UNKNOWN se considera bloqueante.
-- Nunca liberar automaticamente una operacion
-- cuya emision fiscal no ha sido comprobada.

CREATE UNIQUE INDEX IF NOT EXISTS
  fiscal_device_one_active_operation_idx
ON public.fiscal_operations (device_id)
WHERE device_id IS NOT NULL
  AND state IN (
    'claimed',
    'sending',
    'unknown'
  );

-- =====================================================
-- 3. RESERVA ATOMICA DE OPERACION
-- =====================================================

CREATE OR REPLACE FUNCTION
public.rc_fiscal_claim_next(
  p_restaurant_user_id uuid,
  p_device_id uuid,
  p_claim_token_hash text
)
RETURNS TABLE (
  operation_id uuid,
  claim_expires_at timestamptz,
  fiscal_payload jsonb
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_operation_id uuid;
  v_payload jsonb;
  v_expires_at timestamptz;
  v_device public.fiscal_devices%ROWTYPE;
BEGIN
  -- Este contrato recibe un hash SHA-256
  -- generado por el servidor de confianza.
  -- Nunca recibe el secreto original.

  IF p_restaurant_user_id IS NULL
     OR p_device_id IS NULL
     OR p_claim_token_hash IS NULL
     OR p_claim_token_hash !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION
      'Invalid claim parameters'
      USING ERRCODE = '22023';
  END IF;

  -- Bloqueo del dispositivo.
  -- Serializa las reservas concurrentes.

  SELECT *
  INTO v_device
  FROM public.fiscal_devices
  WHERE id = p_device_id
    AND restaurant_user_id =
      p_restaurant_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Fiscal device not found'
      USING ERRCODE = '42501';
  END IF;

  IF v_device.enabled IS DISTINCT FROM TRUE
     OR v_device.environment <> 'test'
  THEN
    RAISE EXCEPTION
      'Device not enabled for staging'
      USING ERRCODE = '42501';
  END IF;

  -- No reutilizar dispositivo bloqueado.
  -- Incluso un resultado UNKNOWN mantiene
  -- suspendidas las nuevas operaciones.

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

  -- Buscar la primera operacion pendiente
  -- dentro del restaurante seleccionado.
  --
  -- SKIP LOCKED evita que dos workers
  -- reclamen simultaneamente la misma fila.

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

  v_expires_at :=
    clock_timestamp() + INTERVAL '2 minutes';

  UPDATE public.fiscal_operations fo
  SET
    state = 'claimed',
    device_id = p_device_id,
    claim_token_hash = p_claim_token_hash,
    claim_expires_at = v_expires_at,
    updated_at = clock_timestamp()
  WHERE fo.id = v_operation_id
    AND fo.restaurant_user_id =
      p_restaurant_user_id
    AND fo.state = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Fiscal claim conflict'
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
  claim_expires_at := v_expires_at;
  fiscal_payload := v_payload;

  RETURN NEXT;
END;
$function$;

-- =====================================================
-- 4. MARCAR INICIO DE TRANSMISION
-- =====================================================

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
AS $function$
DECLARE
  v_operation public.fiscal_operations%ROWTYPE;
BEGIN

  IF p_operation_id IS NULL
     OR p_device_id IS NULL
     OR p_claim_token_hash IS NULL
     OR p_claim_token_hash !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION
      'Invalid operation parameters'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_operation
  FROM public.fiscal_operations
  WHERE id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Fiscal operation not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_operation.device_id
       IS DISTINCT FROM p_device_id
     OR v_operation.claim_token_hash
       IS DISTINCT FROM p_claim_token_hash
  THEN
    RAISE EXCEPTION
      'Fiscal claim mismatch'
      USING ERRCODE = '42501';
  END IF;

  IF v_operation.state <> 'claimed' THEN
    RAISE EXCEPTION
      'Operation is not claimed'
      USING ERRCODE = '55000';
  END IF;

  IF v_operation.claim_expires_at IS NULL
     OR v_operation.claim_expires_at
       <= clock_timestamp()
  THEN
    RAISE EXCEPTION
      'Fiscal claim expired'
      USING ERRCODE = '55000';
  END IF;

  -- El dispositivo debe continuar asociado
  -- al mismo restaurante y en modo test.

  IF NOT EXISTS (
    SELECT 1
    FROM public.fiscal_devices fd
    WHERE fd.id = p_device_id
      AND fd.restaurant_user_id =
        v_operation.restaurant_user_id
      AND fd.enabled = true
      AND fd.environment = 'test'
  ) THEN
    RAISE EXCEPTION
      'Fiscal device authorization failed'
      USING ERRCODE = '42501';
  END IF;

  -- Estado SENDING se registra ANTES
  -- de transmitir al dispositivo.
  --
  -- Ante caida de red, este estado
  -- requiere conciliacion manual/segura.

  UPDATE public.fiscal_operations
  SET
    state = 'sending',
    updated_at = clock_timestamp()
  WHERE id = p_operation_id
    AND state = 'claimed';

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
$function$;

-- =====================================================
-- 5. CERRAR PERMISOS RPC
-- =====================================================

REVOKE ALL ON FUNCTION
public.rc_fiscal_claim_next(
  uuid, uuid, text
)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
public.rc_fiscal_mark_sending(
  uuid, uuid, text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rc_fiscal_claim_next(
  uuid, uuid, text
)
TO service_role;

GRANT EXECUTE ON FUNCTION
public.rc_fiscal_mark_sending(
  uuid, uuid, text
)
TO service_role;

COMMIT;
