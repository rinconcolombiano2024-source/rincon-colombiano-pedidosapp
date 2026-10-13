-- STAGING FIRST. Requires the reviewed V6 deployed-RPC compatibility migration.
-- Preserves complete existing functions, locks, server pricing and ACLs.
-- Allows pending online orders for SumUp in PL; does NOT enable/check out money.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $compat$
DECLARE
  item record;
  function_oid oid;
  definition text;
  previous_acl text;
  predicate text := $predicate$) NOT IN ('stripe','sumup')
    OR (v_payment_method = 'Online'
      AND lower(trim(coalesce(v_settings->>'onlinePaymentProvider','disabled'))) = 'sumup'
      AND upper(trim(coalesce(v_restaurant_country,''))) <> 'PL')$predicate$;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric)',
     'f5b045debae4f302d1c7f749b3a1ea85'),
    ('public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)',
     '9545dbd6502886000ca7168f4fc9ab13')
  ) AS expected(signature, fingerprint) LOOP
    function_oid := to_regprocedure(item.signature);
    IF function_oid IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc WHERE oid=function_oid
        AND md5(btrim(regexp_replace(prosrc,'\s+',' ','g'))) = item.fingerprint
    ) THEN RAISE EXCEPTION 'SUMUP_ORDER_COMPAT_BASELINE_DRIFT: %',item.signature; END IF;
    SELECT proacl::text INTO previous_acl FROM pg_catalog.pg_proc WHERE oid=function_oid;
    definition := pg_get_functiondef(function_oid);
    IF (SELECT count(*) FROM regexp_matches(definition, '[)]\s*<>\s*''stripe''', 'g')) <> 1 THEN
      RAISE EXCEPTION 'SUMUP_ORDER_COMPAT_PREDICATE_MISMATCH';
    END IF;
    definition := regexp_replace(definition,'[)]\s*<>\s*''stripe''',predicate);
    EXECUTE definition;
    IF (SELECT proacl::text FROM pg_catalog.pg_proc WHERE oid=function_oid) IS DISTINCT FROM previous_acl THEN
      RAISE EXCEPTION 'SUMUP_ORDER_COMPAT_ACL_CHANGED';
    END IF;
  END LOOP;
END;
$compat$;
NOTIFY pgrst, 'reload schema';
COMMIT;
