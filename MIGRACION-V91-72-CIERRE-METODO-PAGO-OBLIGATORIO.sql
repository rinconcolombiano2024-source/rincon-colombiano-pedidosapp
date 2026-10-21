-- RC ORDERA: fail closed on missing payment method before any period close.
-- Review and run in a controlled migration window; never auto-apply to live orders.
begin;
do $migration$
declare
  v_definition text;
  v_marker constant text := '-- rc_ordera_payment_method_closure_guard_20261021';
  v_anchor text := '  return query';
  v_guard text := $guard$  -- rc_ordera_payment_method_closure_guard_20261021
  if exists (
    select 1 from public.orders o
    where o.user_id = v_owner_id
      and o.business_date >= v_start_date and o.business_date < v_end_date
      and lower(trim(coalesce(nullif(o.canonical_status, ''), nullif(o.status, ''), o.order_json->>'canonicalStatus', o.order_json->>'status', 'completed'))) not in ('cancelled','rejected')
      and (
        nullif(trim(coalesce(o.order_json->>'paymentMethod', o.order_json->>'payment_method', '')), '') is null
        or lower(trim(coalesce(o.order_json->>'paymentMethod', o.order_json->>'payment_method', ''))) in ('unknown','unspecified','no indicado','sin especificar','brak danych','none','null')
      )
  ) then
    raise exception 'RC_ORDERA_CLOSURE_PAYMENT_METHOD_REQUIRED' using errcode = 'P0001';
  end if;

  -- Validate report completeness in the same SECURITY DEFINER transaction.
  -- The grouped payment ticket count must reconcile with the sale ticket count.
  if v_report is null
     or v_report->>'order_count' is null
     or jsonb_typeof(v_report->'payment_methods') is distinct from 'array'
     or coalesce((
       select sum((pm->>'orders')::integer)
       from jsonb_array_elements(v_report->'payment_methods') pm
     ), 0) <> (v_report->>'order_count')::integer
     or exists (
       select 1 from jsonb_array_elements(v_report->'payment_methods') pm
       where nullif(trim(coalesce(pm->>'payment_method', '')), '') is null
          or lower(trim(pm->>'payment_method')) in
            ('unknown','unspecified','no indicado','sin especificar','brak danych','none','null')
     )
  then
    raise exception 'RC_ORDERA_CLOSURE_REPORT_INCOMPLETE' using errcode = 'P0001';
  end if;

$guard$;
begin
  select pg_get_functiondef('public.close_current_restaurant_period(text,date)'::regprocedure) into v_definition;
  if position(v_marker in v_definition) > 0 then return; end if;
  if position('v91_25_single_report' in v_definition) = 0 or
     (length(v_definition)-length(replace(v_definition,v_anchor,''))) <> length(v_anchor) then
    raise exception 'Closure function contract changed; migration not applied';
  end if;
  execute replace(v_definition,v_anchor,v_guard || v_anchor);
end;
$migration$;
commit;
