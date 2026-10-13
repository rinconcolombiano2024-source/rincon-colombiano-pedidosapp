-- Incremental replacement of the reviewed V91-73 commit RPC. STAGING FIRST.
-- SumUp Hosted URL UUID is NOT the checkout UUID (official API example).
-- No writes to customer orders, payment_transactions or historical migrations.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
BEGIN
  IF to_regprocedure('public.rc_sumup_commit_checkout(uuid,uuid,text)') IS NULL
    OR to_regclass('public.rc_sumup_payment_attempts') IS NULL THEN
    RAISE EXCEPTION 'SUMUP_COMPAT_DEPENDENCY_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc
    WHERE oid = 'public.rc_sumup_commit_checkout(uuid,uuid,text)'::regprocedure
      AND md5(regexp_replace(prosrc, '\s+', '', 'g')) = '662c1c9d663025088de1722ddaa97ae6'
  ) THEN
    RAISE EXCEPTION 'SUMUP_COMPAT_BASELINE_DRIFT';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.rc_sumup_commit_checkout(
  p_attempt_id uuid, p_checkout_id uuid, p_hosted_url text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  a public.rc_sumup_payment_attempts%ROWTYPE;
  o public.customer_orders%ROWTYPE;
  order_key uuid;
BEGIN
  -- Immutable lookup followed by the existing ORDER -> ATTEMPT lock order.
  SELECT order_id INTO order_key
  FROM public.rc_sumup_payment_attempts WHERE id = p_attempt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUMUP_PROVIDER_CHECKOUT_MISMATCH'; END IF;
  SELECT * INTO o FROM public.customer_orders WHERE id = order_key FOR UPDATE;
  IF NOT FOUND OR o.status IS DISTINCT FROM 'pending'
    OR lower(o.payment_status) NOT IN ('pending','failed','') OR o.payment_status IS NULL
    OR lower(o.payment_method) IS DISTINCT FROM 'online'
    OR upper(o.currency) IS DISTINCT FROM 'PLN' THEN
    RAISE EXCEPTION 'SUMUP_ORDER_CHANGED';
  END IF;
  SELECT * INTO a FROM public.rc_sumup_payment_attempts
    WHERE id = p_attempt_id AND order_id = order_key FOR UPDATE;
  IF NOT FOUND OR a.status IS DISTINCT FROM 'creating' OR a.checkout_id IS NOT NULL
    OR p_checkout_id IS NULL OR p_hosted_url IS NULL
    OR p_hosted_url !~ '^https://checkout[.]sumup[.]com/pay/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/?$'
    OR o.user_id IS DISTINCT FROM a.restaurant_user_id
    OR o.total * 100 IS DISTINCT FROM a.amount_minor::numeric
    OR a.currency IS DISTINCT FROM 'PLN' THEN
    RAISE EXCEPTION 'SUMUP_PROVIDER_CHECKOUT_MISMATCH';
  END IF;
  -- Both IDs came from a provider-verified response, not from browser input.
  -- Store their association. A hosted page is not proof of successful payment.
  UPDATE public.rc_sumup_payment_attempts
  SET checkout_id = p_checkout_id, hosted_url = p_hosted_url,
      status = 'pending', updated_at = now()
  WHERE id = a.id;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.rc_sumup_commit_checkout(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rc_sumup_commit_checkout(uuid,uuid,text) TO service_role;
DO $postflight$
BEGIN
  IF has_function_privilege('anon', 'public.rc_sumup_commit_checkout(uuid,uuid,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.rc_sumup_commit_checkout(uuid,uuid,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.rc_sumup_commit_checkout(uuid,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SUMUP_COMPAT_ACL_INVALID';
  END IF;
END;
$postflight$;
-- Associate a checkout found by a server-only verified reference lookup.
-- Does not create a PSP checkout. ORDER -> ATTEMPT lock order is unchanged.
CREATE OR REPLACE FUNCTION public.rc_sumup_recover_verified_checkout(
  p_attempt_id uuid, p_restaurant_user_id uuid, p_merchant_code text,
  p_checkout_id uuid, p_provider_status text, p_hosted_url text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $recover$
DECLARE
  a public.rc_sumup_payment_attempts%ROWTYPE;
  o public.customer_orders%ROWTYPE;
  order_key uuid;
BEGIN
  IF p_checkout_id IS NULL OR p_provider_status IS NULL
    OR p_provider_status NOT IN ('PENDING','PAID','FAILED','EXPIRED') THEN
    RAISE EXCEPTION 'SUMUP_RECOVERY_INVALID';
  END IF;
  IF p_hosted_url IS NOT NULL AND p_hosted_url !~ '^https://checkout[.]sumup[.]com/pay/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/?$' THEN
    RAISE EXCEPTION 'SUMUP_RECOVERY_INVALID';
  END IF;
  IF p_provider_status='PENDING' AND p_hosted_url IS NULL THEN RAISE EXCEPTION 'SUMUP_RECOVERY_INVALID'; END IF;
  SELECT order_id INTO order_key FROM public.rc_sumup_payment_attempts WHERE id=p_attempt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUMUP_UNKNOWN_ATTEMPT'; END IF;
  SELECT * INTO o FROM public.customer_orders WHERE id=order_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUMUP_ORDER_MISSING'; END IF;
  SELECT * INTO a FROM public.rc_sumup_payment_attempts WHERE id=p_attempt_id AND order_id=order_key FOR UPDATE;
  IF NOT FOUND OR a.restaurant_user_id IS DISTINCT FROM p_restaurant_user_id
    OR a.restaurant_user_id IS DISTINCT FROM o.user_id OR a.merchant_code IS DISTINCT FROM p_merchant_code
    OR a.currency IS DISTINCT FROM 'PLN'
    OR (a.checkout_id IS NOT NULL AND a.checkout_id IS DISTINCT FROM p_checkout_id) THEN
    RAISE EXCEPTION 'SUMUP_RECOVERY_IDENTITY_MISMATCH';
  END IF;
  IF a.status='paid' THEN RETURN jsonb_build_object('status','paid','idempotent',true); END IF;
  UPDATE public.rc_sumup_payment_attempts SET checkout_id=p_checkout_id,
    hosted_url=coalesce(p_hosted_url,hosted_url),
    status=CASE WHEN status='creating' THEN 'pending' ELSE status END,updated_at=now()
  WHERE id=a.id;
  IF o.total * 100 IS DISTINCT FROM a.amount_minor::numeric OR upper(o.currency) IS DISTINCT FROM 'PLN' THEN
    UPDATE public.rc_sumup_payment_attempts SET status='needs_review',updated_at=now() WHERE id=a.id;
    RETURN jsonb_build_object('status','needs_review');
  END IF;
  -- Existing apply RPC preserves cancellation/other-provider review and ledger uniqueness.
  RETURN public.rc_sumup_apply_verified_checkout(p_checkout_id,p_provider_status);
END;
$recover$;
REVOKE ALL ON FUNCTION public.rc_sumup_recover_verified_checkout(uuid,uuid,text,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rc_sumup_recover_verified_checkout(uuid,uuid,text,uuid,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
