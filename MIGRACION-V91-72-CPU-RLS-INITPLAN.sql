-- RC ORDERA R17. Proposed RLS initPlan optimization — STAGING FIRST.
-- EXPECTS exactly five production policies inspected on 2026-10-12.
-- Does not touch data, grants, roles, columns, payments or Realtime.
-- Apply only after negative/positive RLS tests with real authenticated users.
BEGIN;
DO $preflight$
DECLARE ok_count integer;
BEGIN
  WITH expected(tablename, policyname, command, expression, check_expression) AS (
    VALUES
      ('app_settings','Users manage own app settings','ALL','(auth.uid() = user_id)','(auth.uid() = user_id)'),
      ('orders','Users manage own orders','ALL','(auth.uid() = user_id)','(auth.uid() = user_id)'),
      ('customer_orders','Restaurants read own customer orders','SELECT','(auth.uid() = user_id)',NULL),
      ('customer_orders','Authenticated customers read own customer orders','SELECT','(auth.uid() = customer_user_id)',NULL),
      ('customer_orders','Staff read submitted station orders','SELECT','(auth.uid() = created_by_user_id)',NULL)
  )
  SELECT count(*) INTO ok_count
  FROM expected e
  JOIN pg_catalog.pg_policies p
    ON p.schemaname = 'public' AND p.tablename = e.tablename
   AND p.policyname = e.policyname AND p.cmd = e.command
   AND p.qual = e.expression AND p.with_check IS NOT DISTINCT FROM e.check_expression
   AND p.roles = ARRAY['authenticated']::name[]
   AND p.permissive = 'PERMISSIVE';
  IF ok_count <> 5 THEN
    RAISE EXCEPTION 'RC_ORDERA_RLS_POLICY_DRIFT: expected 5 unchanged policies; got %', ok_count;
  END IF;
END
$preflight$;

ALTER POLICY "Users manage own app settings" ON public.app_settings
  TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users manage own orders" ON public.orders
  TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Restaurants read own customer orders" ON public.customer_orders
  TO authenticated USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Authenticated customers read own customer orders" ON public.customer_orders
  TO authenticated USING ((SELECT auth.uid()) = customer_user_id);
ALTER POLICY "Staff read submitted station orders" ON public.customer_orders
  TO authenticated USING ((SELECT auth.uid()) = created_by_user_id);
COMMIT;
