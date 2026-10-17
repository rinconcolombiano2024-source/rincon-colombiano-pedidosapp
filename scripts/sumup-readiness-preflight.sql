-- RC ORDERA / SumUp: read-only production preflight. No mutations.
-- All required procedures must exist; verify signatures separately before deployment.
WITH requirements(kind, identifier, present) AS (
 VALUES
 ('table','public.customer_orders',to_regclass('public.customer_orders') IS NOT NULL),
 ('table','public.rc_sumup_payment_attempts',to_regclass('public.rc_sumup_payment_attempts') IS NOT NULL),
 ('function','public.rc_sumup_reserve_checkout',EXISTS (
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='rc_sumup_reserve_checkout')),
 ('function','public.rc_sumup_commit_checkout',EXISTS (
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='rc_sumup_commit_checkout')),
 ('function','public.rc_sumup_apply_verified_checkout',EXISTS (
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='rc_sumup_apply_verified_checkout'))
)
SELECT kind,identifier,CASE WHEN present THEN 'PRESENT' ELSE 'MISSING - DO NOT ENABLE PAYMENTS' END AS status
FROM requirements ORDER BY kind,identifier;

-- Review exact signatures and execution grants (never rely on name alone).
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'rc_sumup_%'
ORDER BY p.proname;
-- IMPORTANT: ACTIVE Edge Functions do not imply database readiness.
