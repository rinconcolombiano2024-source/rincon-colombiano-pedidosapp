-- ============================================================
-- RC ORDERA - V91-27
-- P0 SECURITY
-- RATE LIMIT PERSISTENTE PARA CREACION PUBLICA DE PEDIDOS
--
-- Objetivo:
--   - Añadir una primera barrera anti-abuso persistente.
--   - La barrera será consumida por una Edge Function ANTES
--     de ejecutar create_customer_order().
--   - Los intentos fallidos tambien consumiran esta cuota porque
--     la llamada de quota y la creacion del pedido ocurriran en
--     transacciones HTTP independientes.
--
-- IMPORTANTE:
--   - NO modifica create_customer_order().
--   - NO modifica el core V91-22.
--   - NO modifica precios.
--   - NO modifica delivery.
--   - NO modifica pedidos existentes.
--   - NO cambia el contrato frontend/backend.
--   - NO concede acceso a anon/authenticated.
--
-- Requisito:
--   MIGRACION-V91-23-P1-SEGURIDAD-PEDIDOS.sql instalada.
-- ============================================================

BEGIN;


-- ============================================================
-- 1. PRECHECK
--    No instalar sobre una base incompatible.
-- ============================================================

DO $precheck$
BEGIN

  IF to_regprocedure(
    'public.rc_ordera_consume_order_rate_limit(uuid,text,text,interval,integer)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'V91-27 CONTRACT ERROR: rc_ordera_consume_order_rate_limit is missing';
  END IF;


  IF to_regclass(
    'public.customer_order_rate_limit_buckets'
  ) IS NULL THEN
    RAISE EXCEPTION
      'V91-27 CONTRACT ERROR: customer_order_rate_limit_buckets is missing';
  END IF;


  IF to_regprocedure(
    'public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'V91-27 CONTRACT ERROR: V91-23 protected order core is missing';
  END IF;


  IF to_regprocedure(
    'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'V91-27 CONTRACT ERROR: public create_customer_order is missing';
  END IF;

END;
$precheck$;



-- ============================================================
-- 2. CUOTA PERSISTENTE PARA LA FUTURA EDGE FUNCTION
--
-- p_network_hash:
--   SHA-256 calculado en Edge a partir de la IP observada
--   por la infraestructura.
--
-- p_device_hash:
--   SHA-256 de una identidad compuesta por:
--   IP + user-agent + clientGuardId.
--
-- Los valores recibidos YA deben ser SHA-256 hexadecimal.
-- Nunca guardamos IP, User-Agent ni clientGuardId en claro.
-- ============================================================

CREATE OR REPLACE FUNCTION
public.rc_ordera_consume_customer_order_edge_quota(
  p_restaurant_user_id uuid,
  p_network_hash text,
  p_device_hash text
)
RETURNS boolean

LANGUAGE plpgsql
SECURITY DEFINER

SET search_path TO
  'pg_catalog',
  'public',
  'extensions'

AS $function$

DECLARE

  v_network_hash text :=
    lower(
      trim(
        coalesce(
          p_network_hash,
          ''
        )
      )
    );


  v_device_hash text :=
    lower(
      trim(
        coalesce(
          p_device_hash,
          ''
        )
      )
    );


BEGIN


  --------------------------------------------------------------
  -- Restaurante obligatorio
  --------------------------------------------------------------

  IF p_restaurant_user_id IS NULL THEN
    RETURN false;
  END IF;



  --------------------------------------------------------------
  -- El restaurante debe existir y estar activo.
  --
  -- Evita llenar buckets utilizando UUID arbitrarios.
  --------------------------------------------------------------

  IF NOT EXISTS (

    SELECT 1

    FROM public.restaurant_profiles rp

    WHERE rp.user_id = p_restaurant_user_id
      AND rp.active = true
      AND rp.deleted_at IS NULL

  ) THEN

    RETURN false;

  END IF;



  --------------------------------------------------------------
  -- Solamente aceptamos SHA-256 hexadecimal.
  --
  -- 64 caracteres:
  -- 0-9 / a-f
  --------------------------------------------------------------

  IF length(v_network_hash) <> 64
     OR v_network_hash !~ '^[0-9a-f]{64}$'
  THEN

    RETURN false;

  END IF;



  IF length(v_device_hash) <> 64
     OR v_device_hash !~ '^[0-9a-f]{64}$'
  THEN

    RETURN false;

  END IF;



  --------------------------------------------------------------
  -- DISPOSITIVO
  --
  -- Primera barrera:
  --   6 intentos / 10 minutos
  --   20 intentos / hora
  --
  -- Esta cuota se consumira ANTES de llamar al RPC real.
  --------------------------------------------------------------

  PERFORM public.rc_ordera_consume_order_rate_limit(

    p_restaurant_user_id,

    'edge_device_10m_v91_27',

    v_device_hash,

    interval '10 minutes',

    6

  );


  PERFORM public.rc_ordera_consume_order_rate_limit(

    p_restaurant_user_id,

    'edge_device_1h_v91_27',

    v_device_hash,

    interval '1 hour',

    20

  );



  --------------------------------------------------------------
  -- RED / IP
  --
  -- Segunda barrera contra:
  --   - rotacion de clientGuardId;
  --   - UUID nuevos;
  --   - tokens nuevos;
  --   - automatizacion desde un mismo origen.
  --
  -- Se mantiene margen para redes compartidas/NAT:
  --   25 intentos / 5 minutos
  --   100 intentos / hora
  --------------------------------------------------------------

  PERFORM public.rc_ordera_consume_order_rate_limit(

    p_restaurant_user_id,

    'edge_network_5m_v91_27',

    v_network_hash,

    interval '5 minutes',

    25

  );


  PERFORM public.rc_ordera_consume_order_rate_limit(

    p_restaurant_user_id,

    'edge_network_1h_v91_27',

    v_network_hash,

    interval '1 hour',

    100

  );



  --------------------------------------------------------------
  -- Todas las barreras fueron superadas.
  --------------------------------------------------------------

  RETURN true;



EXCEPTION

  --------------------------------------------------------------
  -- rc_ordera_consume_order_rate_limit utiliza P0001 cuando
  -- ORDER_RATE_LIMITED.
  --
  -- En esta funcion la convertimos en FALSE para que Edge pueda
  -- responder limpiamente HTTP 429 sin revelar detalles internos.
  --------------------------------------------------------------

  WHEN SQLSTATE 'P0001' THEN

    RETURN false;

END;

$function$;



-- ============================================================
-- 3. ACL
--
-- CRITICO:
-- anon y authenticated NO pueden consumir directamente esta
-- cuota, porque entonces un atacante podria manipularla.
--
-- Solo la Edge Function con service_role puede ejecutarla.
-- ============================================================

REVOKE ALL ON FUNCTION
public.rc_ordera_consume_customer_order_edge_quota(
  uuid,
  text,
  text
)
FROM PUBLIC;


REVOKE ALL ON FUNCTION
public.rc_ordera_consume_customer_order_edge_quota(
  uuid,
  text,
  text
)
FROM anon;


REVOKE ALL ON FUNCTION
public.rc_ordera_consume_customer_order_edge_quota(
  uuid,
  text,
  text
)
FROM authenticated;


GRANT EXECUTE ON FUNCTION
public.rc_ordera_consume_customer_order_edge_quota(
  uuid,
  text,
  text
)
TO service_role;



-- ============================================================
-- 4. POSTCHECKS DE SEGURIDAD
-- ============================================================

DO $postcheck$
BEGIN


  IF has_function_privilege(

    'anon',

    'public.rc_ordera_consume_customer_order_edge_quota(uuid,text,text)',

    'EXECUTE'

  ) THEN

    RAISE EXCEPTION
      'V91-27 SECURITY ERROR: anon can consume Edge order quota';

  END IF;



  IF has_function_privilege(

    'authenticated',

    'public.rc_ordera_consume_customer_order_edge_quota(uuid,text,text)',

    'EXECUTE'

  ) THEN

    RAISE EXCEPTION
      'V91-27 SECURITY ERROR: authenticated can consume Edge order quota';

  END IF;



  IF NOT has_function_privilege(

    'service_role',

    'public.rc_ordera_consume_customer_order_edge_quota(uuid,text,text)',

    'EXECUTE'

  ) THEN

    RAISE EXCEPTION
      'V91-27 SECURITY ERROR: service_role cannot consume Edge order quota';

  END IF;



  --------------------------------------------------------------
  -- El core protegido V91-22 debe continuar cerrado.
  --------------------------------------------------------------

  IF has_function_privilege(

    'anon',

    'public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)',

    'EXECUTE'

  ) THEN

    RAISE EXCEPTION
      'V91-27 SECURITY ERROR: anon can bypass protected order wrapper';

  END IF;



  IF has_function_privilege(

    'authenticated',

    'public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)',

    'EXECUTE'

  ) THEN

    RAISE EXCEPTION
      'V91-27 SECURITY ERROR: authenticated can bypass protected order wrapper';

  END IF;


END;
$postcheck$;



COMMIT;


-- ============================================================
-- V91-27 PASO 1/3 COMPLETADO
--
-- La funcion queda inactiva para clientes publicos.
-- Solo service_role puede consumirla.
--
-- El siguiente paso sera:
-- supabase/functions/create-customer-order/index.ts
-- ============================================================
