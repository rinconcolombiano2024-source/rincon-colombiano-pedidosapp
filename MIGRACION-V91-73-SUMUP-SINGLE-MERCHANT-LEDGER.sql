-- RC ORDERA R19: isolated SumUp ledger. STAGING ONLY until negative RLS and finance tests.
-- Does NOT replace Stripe Connect or authorize marketplace split settlements.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.customer_orders') IS NULL OR to_regclass('public.app_settings') IS NULL
  OR to_regclass('public.payment_transactions') IS NULL THEN
  RAISE EXCEPTION 'SUMUP_REQUIRED_SCHEMA_MISSING'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.rc_sumup_payment_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL UNIQUE REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
 restaurant_user_id uuid NOT NULL,
 merchant_code text NOT NULL CHECK (merchant_code ~ '^[A-Za-z0-9]{6,32}$'),
 attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number=1),
 checkout_reference text NOT NULL UNIQUE CHECK (length(checkout_reference)<=64),
 amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 100000000),
 currency text NOT NULL DEFAULT 'PLN' CHECK (currency='PLN'),
 status text NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','pending','paid','failed','expired','needs_review')),
 checkout_id uuid UNIQUE, hosted_url text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz
);
ALTER TABLE public.rc_sumup_payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rc_sumup_payment_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.rc_sumup_payment_attempts TO service_role;

-- Single attempt per order. No blind POST retry on network timeout.
CREATE OR REPLACE FUNCTION public.rc_sumup_reserve_checkout(
 p_order_id uuid,p_restaurant_user_id uuid,p_merchant_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.customer_orders%ROWTYPE; a public.rc_sumup_payment_attempts%ROWTYPE;
        minor numeric; selected text; fresh boolean:=false;
BEGIN
 IF p_merchant_code !~ '^[A-Za-z0-9]{6,32}$' THEN RAISE EXCEPTION 'SUMUP_BAD_MERCHANT'; END IF;
 SELECT * INTO o FROM public.customer_orders WHERE id=p_order_id AND user_id=p_restaurant_user_id FOR UPDATE;
 IF NOT FOUND OR o.status <> 'pending' OR lower(o.payment_method)<>'online'
  OR lower(o.payment_status) NOT IN ('pending','failed','') OR upper(o.currency)<>'PLN'
 OR (lower(coalesce(o.payment_provider,'')) NOT IN ('','sumup')) THEN
  RAISE EXCEPTION 'SUMUP_ORDER_NOT_ELIGIBLE'; END IF;
 SELECT settings->>'onlinePaymentProvider' INTO selected FROM public.app_settings
  WHERE user_id=p_restaurant_user_id;
 IF selected IS DISTINCT FROM 'sumup' THEN RAISE EXCEPTION 'SUMUP_RESTAURANT_DISABLED'; END IF;
 -- Fail closed if this order has ever entered a different PSP checkout ledger.
 -- Even a locally failed Stripe attempt can have an asynchronous capture.
 IF EXISTS (
  SELECT 1 FROM public.payment_transactions
   WHERE customer_order_id=p_order_id AND provider <> 'sumup'
 ) THEN RAISE EXCEPTION 'SUMUP_OTHER_PROVIDER_RECONCILIATION_REQUIRED'; END IF;
 minor:=o.total*100;
 IF minor<>trunc(minor) OR minor NOT BETWEEN 1 AND 100000000 THEN
  RAISE EXCEPTION 'SUMUP_AMOUNT_NOT_EXACT'; END IF;
 SELECT * INTO a FROM public.rc_sumup_payment_attempts WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO public.rc_sumup_payment_attempts
   (order_id,restaurant_user_id,merchant_code,checkout_reference,amount_minor)
  VALUES (p_order_id,p_restaurant_user_id,p_merchant_code,'rc-'||p_order_id::text||'-1',minor::bigint)
  RETURNING * INTO a;
  fresh:=true;
 END IF;
 IF a.restaurant_user_id<>p_restaurant_user_id OR a.merchant_code<>p_merchant_code
  OR a.amount_minor<>minor::bigint THEN RAISE EXCEPTION 'SUMUP_ATTEMPT_DRIFT'; END IF;
 -- Persist provider ownership in the same transaction that reserves a SumUp
 -- attempt. The client cannot switch provider to initiate a second checkout.
 UPDATE public.customer_orders SET payment_provider='sumup',updated_at=now()
  WHERE id=p_order_id AND lower(coalesce(payment_provider,'')) IN ('','sumup');
 IF NOT FOUND THEN RAISE EXCEPTION 'SUMUP_PROVIDER_SWITCH_FORBIDDEN'; END IF;
 RETURN jsonb_build_object('attemptId',a.id,'orderId',a.order_id,'attemptNumber',1,
 'amountMinor',a.amount_minor,'currency','PLN','status',a.status,
 'checkoutId',a.checkout_id,'url',a.hosted_url,'creationAllowed',fresh);
END $$;
REVOKE ALL ON FUNCTION public.rc_sumup_reserve_checkout(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rc_sumup_reserve_checkout(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.rc_sumup_commit_checkout(
 p_attempt_id uuid,p_checkout_id uuid,p_hosted_url text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.rc_sumup_payment_attempts%ROWTYPE; o public.customer_orders%ROWTYPE;
        order_key uuid;
BEGIN
 -- Consistent lock order across reservation, checkout and webhook: ORDER then ATTEMPT.
 -- Reading immutable reservation ownership without FOR UPDATE cannot deadlock on attempt.
 SELECT order_id INTO order_key FROM public.rc_sumup_payment_attempts WHERE id=p_attempt_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUMUP_PROVIDER_CHECKOUT_MISMATCH'; END IF;
 SELECT * INTO o FROM public.customer_orders WHERE id=order_key FOR UPDATE;
 IF NOT FOUND OR o.status<>'pending' OR lower(o.payment_status) NOT IN ('pending','failed','')
    OR lower(o.payment_method)<>'online' OR upper(o.currency)<>'PLN'
    OR lower(coalesce(o.payment_provider,'')) <> 'sumup' THEN
   RAISE EXCEPTION 'SUMUP_ORDER_CHANGED'; END IF;
 SELECT * INTO a FROM public.rc_sumup_payment_attempts
   WHERE id=p_attempt_id AND order_id=order_key FOR UPDATE;
 IF NOT FOUND OR a.status<>'creating' OR a.checkout_id IS NOT NULL OR p_checkout_id IS NULL
 OR o.total*100 <> a.amount_minor
 OR p_hosted_url IS DISTINCT FROM 'https://checkout.sumup.com/pay/'||p_checkout_id::text THEN
   RAISE EXCEPTION 'SUMUP_PROVIDER_CHECKOUT_MISMATCH'; END IF;
 UPDATE public.rc_sumup_payment_attempts SET checkout_id=p_checkout_id,hosted_url=p_hosted_url,
  status='pending',updated_at=now() WHERE id=a.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.rc_sumup_commit_checkout(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rc_sumup_commit_checkout(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.rc_sumup_apply_verified_checkout(
 p_checkout_id uuid,p_provider_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.rc_sumup_payment_attempts%ROWTYPE; o public.customer_orders%ROWTYPE;
        tx public.payment_transactions%ROWTYPE;
        order_key uuid;
BEGIN
 IF p_provider_status NOT IN ('PENDING','PAID','FAILED','EXPIRED') THEN
  RAISE EXCEPTION 'SUMUP_UNKNOWN_PROVIDER_STATUS'; END IF;
 -- The webhook must not lock ATTEMPT before ORDER: cancellation and reservation
 -- lock ORDER first, so reversing creates an AB/BA deadlock under production load.
 SELECT order_id INTO order_key FROM public.rc_sumup_payment_attempts
  WHERE checkout_id=p_checkout_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUMUP_UNKNOWN_CHECKOUT'; END IF;
 SELECT * INTO o FROM public.customer_orders WHERE id=order_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUMUP_ORDER_MISSING'; END IF;
 SELECT * INTO a FROM public.rc_sumup_payment_attempts
  WHERE checkout_id=p_checkout_id AND order_id=order_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUMUP_UNKNOWN_CHECKOUT'; END IF;
 IF a.status='paid' THEN RETURN jsonb_build_object('status','paid','idempotent',true); END IF;
 -- Never recognize a NEW provider capture against an altered sale total.
 IF upper(o.currency) <> 'PLN' OR o.total*100 <> a.amount_minor THEN
  UPDATE public.rc_sumup_payment_attempts SET status='needs_review',updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('status','needs_review','reason','AMOUNT_DRIFT');
 END IF;
 IF p_provider_status='PENDING' THEN RETURN jsonb_build_object('status',a.status); END IF;
 IF p_provider_status IN ('FAILED','EXPIRED') THEN
  UPDATE public.rc_sumup_payment_attempts SET status=lower(p_provider_status),updated_at=now()
   WHERE id=a.id AND status='pending';
  RETURN jsonb_build_object('status',lower(p_provider_status));
 END IF;
 IF o.status='cancelled' OR o.canonical_status='cancelled'
 OR EXISTS (SELECT 1 FROM public.payment_transactions
   WHERE customer_order_id=a.order_id AND provider <> 'sumup')
 OR lower(o.payment_status) NOT IN ('pending','failed','')
 OR (o.payment_provider<>'' AND lower(o.payment_provider)<>'sumup') THEN
  UPDATE public.rc_sumup_payment_attempts SET status='needs_review',updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('status','needs_review');
 END IF;
 INSERT INTO public.payment_transactions
  (customer_order_id,provider,provider_reference,payment_method,status,amount,currency,
   idempotency_key,provider_session_id,paid_at)
 VALUES (a.order_id,'sumup',p_checkout_id::text,'online','paid',a.amount_minor::numeric/100,
  'PLN','sumup:'||p_checkout_id::text,p_checkout_id::text,now())
 ON CONFLICT (customer_order_id,idempotency_key) DO NOTHING;
 SELECT * INTO tx FROM public.payment_transactions WHERE customer_order_id=a.order_id
  AND idempotency_key='sumup:'||p_checkout_id::text;
 IF NOT FOUND OR tx.provider<>'sumup' OR tx.status<>'paid'
  OR tx.amount<>a.amount_minor::numeric/100 OR tx.currency<>'PLN' THEN
   RAISE EXCEPTION 'SUMUP_LEDGER_CONFLICT'; END IF;
 UPDATE public.customer_orders SET payment_status='paid',payment_provider='sumup',
  provider_reference=p_checkout_id::text,payment_amount=a.amount_minor::numeric/100,
  payment_currency='PLN',paid_at=coalesce(paid_at,now()),updated_at=now()
 WHERE id=a.order_id;
 UPDATE public.rc_sumup_payment_attempts SET status='paid',paid_at=coalesce(paid_at,now()),
  updated_at=now() WHERE id=a.id;
 RETURN jsonb_build_object('status','paid','idempotent',false);
END $$;
REVOKE ALL ON FUNCTION public.rc_sumup_apply_verified_checkout(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rc_sumup_apply_verified_checkout(uuid,text) TO service_role;

-- Stop pending/unknown SumUp charge from being cancelled as if it were unpaid.
CREATE OR REPLACE FUNCTION public.rc_sumup_guard_customer_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (NEW.status='cancelled' OR NEW.canonical_status='cancelled')
  AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.canonical_status IS DISTINCT FROM NEW.canonical_status)
  AND EXISTS (SELECT 1 FROM public.rc_sumup_payment_attempts WHERE order_id=OLD.id
   AND status IN ('creating','pending','needs_review')) THEN
  RAISE EXCEPTION 'SUMUP_RECONCILIATION_REQUIRED';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rc_sumup_guard_cancel ON public.customer_orders;
CREATE TRIGGER rc_sumup_guard_cancel BEFORE UPDATE OF status,canonical_status ON public.customer_orders
 FOR EACH ROW EXECUTE FUNCTION public.rc_sumup_guard_customer_cancel();
REVOKE ALL ON FUNCTION public.rc_sumup_guard_customer_cancel() FROM PUBLIC,anon,authenticated;
COMMIT;
