-- Reject absent required JSON fields; SQL NULL must not skip the close gate.
-- Additive upgrade to V91-78. No orders, payments or historical closures change.
BEGIN;
DO $upgrade$
DECLARE
  v_definition text;
  v_before text := $old$  IF NEW.report_snapshot IS NULL OR jsonb_typeof(NEW.report_snapshot) <> 'object'
     OR jsonb_typeof(NEW.report_snapshot->'order_count') <> 'number'
     OR jsonb_typeof(NEW.report_snapshot->'sales_total') <> 'number'
     OR jsonb_typeof(NEW.report_snapshot->'payment_methods') <> 'array' THEN$old$;
  v_after text := $new$  IF NEW.report_snapshot IS NULL OR jsonb_typeof(NEW.report_snapshot) IS DISTINCT FROM 'object'
     OR jsonb_typeof(NEW.report_snapshot->'order_count') IS DISTINCT FROM 'number'
     OR jsonb_typeof(NEW.report_snapshot->'sales_total') IS DISTINCT FROM 'number'
     OR jsonb_typeof(NEW.report_snapshot->'payment_methods') IS DISTINCT FROM 'array' THEN$new$;
BEGIN
  IF to_regprocedure('public.rc_ordera_check_period_close_before_write()') IS NULL THEN
    RAISE EXCEPTION 'RC_ORDERA_CLOSE_V91_78_REQUIRED';
  END IF;
  SELECT pg_get_functiondef('public.rc_ordera_check_period_close_before_write()'::regprocedure)
    INTO v_definition;
  IF strpos(v_definition,v_after)>0 THEN RETURN; END IF;
  IF strpos(v_definition,v_before)=0 THEN
    RAISE EXCEPTION 'RC_ORDERA_CLOSE_GUARD_CONTRACT_CHANGED';
  END IF;
  EXECUTE replace(v_definition,v_before,v_after);
END;
$upgrade$;
COMMIT;
