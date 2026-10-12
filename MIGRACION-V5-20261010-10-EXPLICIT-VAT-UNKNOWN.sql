-- V5-10 / consolidated V6: explicitly unknown product VAT must not inherit a default.
-- No change to historical migrations or orders. Apply in staging before UI rollout.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $guard$
DECLARE v_oid regprocedure := to_regprocedure('public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric)'); v_body text; v_hash text;
BEGIN
 IF v_oid IS NULL THEN RAISE EXCEPTION 'Apply V5-05 first'; END IF;
 SELECT prosrc,md5(btrim(regexp_replace(prosrc,'\s+',' ','g'))) INTO v_body,v_hash FROM pg_proc WHERE oid=v_oid;
 IF v_hash NOT IN ('e7ce54f93f6002fd476e1cbfb7fcff1c','9cc654511e63ae2d154e1287868cc782') THEN RAISE EXCEPTION 'Unexpected order RPC body: review drift before V5-10'; END IF;
 IF v_hash='e7ce54f93f6002fd476e1cbfb7fcff1c' THEN
   EXECUTE replace(pg_get_functiondef(v_oid), $before$v_menu_item ? 'vatRate' and v_menu_item->'vatRate' <> 'null'::jsonb$before$, $after$v_menu_item ? 'vatRate'$after$);
 END IF;
 IF (SELECT md5(btrim(regexp_replace(prosrc,'\s+',' ','g'))) FROM pg_proc WHERE oid=v_oid) <> '9cc654511e63ae2d154e1287868cc782'
 THEN RAISE EXCEPTION 'VAT null preservation postcondition failed'; END IF;
 IF has_function_privilege('anon',v_oid,'EXECUTE') OR has_function_privilege('authenticated',v_oid,'EXECUTE')
 OR NOT has_function_privilege('service_role',v_oid,'EXECUTE') THEN RAISE EXCEPTION 'Order RPC privileges changed'; END IF;
END $guard$;
NOTIFY pgrst,'reload schema';
COMMIT;
-- Recovery: pause order entry if needed, preserve orders and snapshots; review VAT and roll forward.
-- Do not reintroduce implicit defaulting of explicitly unknown categories.
