
-- ============================================================
-- RC ORDERA V91-55
-- BOUNDED EXTERNAL DELIVERY BATCH AUDIT
--
-- Requires V91-52.
-- Service-role only.
-- Read-only.
--
-- NO inserts, updates, fiscal operations,
-- sales, kitchen dispatch, cron or polling.
--
-- STAGING FIRST.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regclass(
    'public.rc_external_delivery_inbox'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_36_REQUIRED';
  END IF;

  IF to_regprocedure(
    'public.rc_external_consolidated_audit(uuid,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'V91_52_REQUIRED';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION
public.rc_external_batch_audit(
  p_restaurant_user_id uuid,
  p_limit integer DEFAULT 10,
  p_status text DEFAULT 'received'
)
RETURNS TABLE (
  inbox_id uuid,
  platform text,
  external_order_id text,
  processing_status text,
  received_at timestamptz,
  catalog_valid boolean,
  arithmetic_valid boolean,
  review_required boolean,
  verdict text,
  import_allowed boolean,
  fiscal_print_allowed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN

  -- Reject missing restaurant identity.
  IF p_restaurant_user_id IS NULL THEN
    RAISE EXCEPTION 'RESTAURANT_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  -- Hard limit for CPU and memory control.
  IF p_limit IS NULL
     OR p_limit < 1
     OR p_limit > 10
  THEN
    RAISE EXCEPTION 'INVALID_BATCH_LIMIT'
      USING ERRCODE = '22023';
  END IF;

  -- Explicitly supported states.
  IF p_status IS NULL
     OR p_status NOT IN (
       'received',
       'needs_review'
     )
  THEN
    RAISE EXCEPTION 'INVALID_BATCH_STATUS'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY

  WITH selected_orders AS MATERIALIZED (
    SELECT
      i.id,
      i.platform,
      i.external_order_id,
      i.processing_status,
      i.received_at
    FROM public.rc_external_delivery_inbox i

    WHERE i.restaurant_user_id =
      p_restaurant_user_id

      AND i.processing_status = p_status

    ORDER BY
      i.received_at ASC,
      i.id ASC

    LIMIT p_limit
  )

  SELECT
    s.id,
    s.platform,
    s.external_order_id,
    s.processing_status,
    s.received_at,

    a.catalog_valid,
    a.arithmetic_valid,
    a.review_required,
    a.verdict,

    -- Always disabled until import and fiscal
    -- workflows have independent approval.
    false AS import_allowed,
    false AS fiscal_print_allowed

  FROM selected_orders s

  CROSS JOIN LATERAL
    public.rc_external_consolidated_audit(
      p_restaurant_user_id,
      s.id
    ) AS a

  ORDER BY
    s.received_at ASC,
    s.id ASC;

END;
$function$;

-- Deny direct browser execution.
REVOKE ALL ON FUNCTION
public.rc_external_batch_audit(
  uuid, integer, text
)
FROM PUBLIC, anon, authenticated;

-- Trusted server only.
GRANT EXECUTE ON FUNCTION
public.rc_external_batch_audit(
  uuid, integer, text
)
TO service_role;

COMMIT;
