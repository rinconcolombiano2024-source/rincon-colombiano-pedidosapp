-- STAGING FIRST. Close the reverse SumUp -> Stripe reservation path.
-- Existing SumUp reservation already rejects any prior non-SumUp attempt.
-- This guard only rejects NEW pending reservations, never provider-paid evidence.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
BEGIN
  IF to_regclass('public.rc_sumup_payment_attempts') IS NULL
    OR to_regclass('public.payment_transactions') IS NULL
    OR to_regclass('public.customer_orders') IS NULL
    OR to_regprocedure('public.rc_sumup_reserve_checkout(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'SUMUP_PROVIDER_GUARD_DEPENDENCY_MISSING';
  END IF;
END;
$preflight$;
CREATE OR REPLACE FUNCTION public.rc_sumup_guard_other_provider_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF NEW.customer_order_id IS NOT NULL AND NEW.provider IS DISTINCT FROM 'sumup'
    AND NEW.status = 'pending' THEN
    -- Same order lock as rc_sumup_reserve_checkout. No network work in transaction.
    PERFORM 1 FROM public.customer_orders WHERE id=NEW.customer_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_ORDER_MISSING'; END IF;
    IF EXISTS (SELECT 1 FROM public.rc_sumup_payment_attempts WHERE order_id=NEW.customer_order_id) THEN
      RAISE EXCEPTION 'SUMUP_OTHER_PROVIDER_RECONCILIATION_REQUIRED' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.rc_sumup_guard_other_provider_reservation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rc_sumup_guard_other_provider_reservation() TO service_role;
DROP TRIGGER IF EXISTS rc_sumup_guard_other_provider_reservation ON public.payment_transactions;
CREATE TRIGGER rc_sumup_guard_other_provider_reservation
BEFORE INSERT OR UPDATE OF status, provider, customer_order_id ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.rc_sumup_guard_other_provider_reservation();
COMMIT;
