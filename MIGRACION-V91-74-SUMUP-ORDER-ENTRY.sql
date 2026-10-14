-- R19. Apply after V91-73 in staging, then validate before production.
-- Preserve the deployed order validator, pricing, idempotency and permissions.
-- Only the service-role Edge entry point gains SumUp local/pickup eligibility.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $migration$
DECLARE
  target regprocedure := to_regprocedure('public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric)');
  definition text;
  old_gate text := $old$  if v_payment_method = 'Online'
     and lower(trim(coalesce(v_settings->>'onlinePaymentProvider', 'disabled'))) <> 'stripe' then
    raise exception 'Online payment is unavailable';
  end if;$old$;
  new_gate text := $new$  if v_payment_method = 'Online'
     and not (
       lower(trim(coalesce(v_settings->>'onlinePaymentProvider', 'disabled'))) = 'stripe'
       or (
         v_settings->>'onlinePaymentProvider' = 'sumup'
         and v_restaurant_country = 'PL'
         and p_order_type in ('Comer en el punto', 'Recoger en el punto')
         and coalesce((p_order_json->>'tipAmount')::numeric, 0) = 0
       )
     ) then
    raise exception 'Online payment is unavailable';
  end if;$new$;
BEGIN
  IF target IS NULL OR to_regprocedure('public.rc_sumup_reserve_checkout(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'SUMUP_ORDER_ENTRY_PREREQUISITES_MISSING';
  END IF;
  SELECT pg_get_functiondef(target) INTO definition;
  IF strpos(definition, new_gate) > 0 THEN RETURN; END IF;
  IF (length(definition) - length(replace(definition, old_gate, ''))) <> length(old_gate) THEN
    RAISE EXCEPTION 'SUMUP_ORDER_ENTRY_DEFINITION_MISMATCH';
  END IF;
  EXECUTE replace(definition, old_gate, new_gate);
END $migration$;
COMMIT;
