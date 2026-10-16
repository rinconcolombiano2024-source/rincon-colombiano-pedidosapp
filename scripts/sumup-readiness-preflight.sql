-- RC ORDERA SumUp production readiness: READ ONLY.
-- Run in Supabase SQL editor. Any missing dependency blocks enabling payments.
WITH requirements(kind, identifier, present) AS (
 VALUES
 ('table','public.customer_orders',to_regclass('public.customer_orders') IS NOT NULL),
 ('table','public.rc_sumup_payment_attempts',to_regclass('public.rc_sumup_payment_attempts') IS NOT NULL),
 ('function','public.rc_sumup_reserve_checkout(uuid,uuid,text)',to_regprocedure('public.rc_sumup_reserve_checkout(uuid,uuid,text)') IS NOT NULL),
 ('function','public.rc_sumup_commit_checkout(uuid,uuid,text)',to_regprocedure('public.rc_sumup_commit_checkout(uuid,uuid,text)') IS NOT NULL),
 ('function','public.rc_sumup_apply_verified_checkout(uuid,text)',to_regprocedure('public.rc_sumup_apply_verified_checkout(uuid,text)') IS NOT NULL)
)
SELECT kind,identifier,CASE WHEN present THEN 'PRESENT' ELSE 'MISSING - DO NOT ENABLE PAYMENTS' END AS status
FROM requirements ORDER BY kind,identifier;
-- IMPORTANT: check actual signatures in pg_proc if any row is MISSING.
-- Never infer successful deployment from an ACTIVE Edge Function.
