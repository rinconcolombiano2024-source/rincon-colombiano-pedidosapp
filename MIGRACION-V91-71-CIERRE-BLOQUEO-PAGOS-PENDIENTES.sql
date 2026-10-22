-- RC ORDERA: non-destructive financial-close guard.
-- Review on staging before applying to production. Existing orders and closures are never rewritten.
CREATE OR REPLACE FUNCTION public.close_current_restaurant_period(p_period_type text, p_anchor_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(closure_id uuid, report_snapshot jsonb, closed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_owner_id uuid := auth.uid();
  v_period_type text := lower(trim(coalesce(p_period_type, '')));
  v_start_date date;
  v_end_date date;
  v_timezone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_report jsonb;
begin
  if v_owner_id is null or not exists (
    select 1 from public.restaurant_profiles rp where rp.user_id = v_owner_id and rp.deleted_at is null
  ) then raise exception 'Restaurant owner profile is missing'; end if;
  if v_period_type = 'day' then
    v_start_date := p_anchor_date; v_end_date := p_anchor_date + 1;
  elsif v_period_type = 'month' then
    v_start_date := date_trunc('month', p_anchor_date)::date;
    v_end_date := (v_start_date + interval '1 month')::date;
  elsif v_period_type = 'year' then
    v_start_date := date_trunc('year', p_anchor_date)::date;
    v_end_date := (v_start_date + interval '1 year')::date;
  else raise exception 'Invalid closure period'; end if;

  select coalesce(nullif(trim(rp.timezone), ''),
    case upper(trim(coalesce(rp.country_code, ''))) when 'PL' then 'Europe/Warsaw' when 'CO' then 'America/Bogota' else 'UTC' end)
  into v_timezone from public.restaurant_profiles rp where rp.user_id = v_owner_id;
  v_start_at := v_start_date::timestamp at time zone v_timezone;
  v_end_at := v_end_date::timestamp at time zone v_timezone;

  -- Financial close is forbidden while any non-cancelled order lacks a verified paid state,
  -- a recorded payment method, or has an unfinished workflow status.
  -- This guard is scoped to the authenticated restaurant and selected business period.
  if exists (
    select 1 from public.orders o
    where o.user_id = v_owner_id
      and o.business_date >= v_start_date and o.business_date < v_end_date
      and lower(trim(coalesce(nullif(o.canonical_status, ''), nullif(o.status, ''),
        o.order_json->>'canonicalStatus', o.order_json->>'status', 'completed')))
        not in ('cancelled', 'rejected')
      and (
        nullif(trim(coalesce(o.order_json->>'paymentMethod', '')), '') is null
        or lower(trim(coalesce(o.order_json->>'paymentStatus', ''))) <> 'paid'
        or lower(trim(coalesce(o.order_json->>'status', ''))) in
          ('new', 'nuevo', 'pending', 'pendiente', 'preparing', 'preparacion',
           'preparación', 'in_preparation', 'in preparation', 'en preparación', 'en preparacion')
        or lower(trim(coalesce(o.status, ''))) in
          ('new', 'nuevo', 'pending', 'pendiente', 'preparing', 'preparacion',
           'preparación', 'in_preparation', 'in preparation', 'en preparación', 'en preparacion')
      )
  ) then
    raise exception using errcode = 'P0001',
      message = 'Cierre bloqueado: existen pedidos sin cobrar, sin método de pago o todavía en preparación.';
  end if;

  -- v91_25_single_report: mismo motor y estados que el reporte visible.
  v_report := public.get_restaurant_closure_report(v_period_type,
    case v_period_type when 'day' then to_char(v_start_date, 'YYYY-MM-DD')
      when 'month' then to_char(v_start_date, 'YYYY-MM') else to_char(v_start_date, 'YYYY') end);
  v_report := jsonb_build_object(
    'period_type', v_period_type, 'period_start', v_start_date, 'period_end', v_end_date - 1,
    'timezone', v_timezone, 'order_count', v_report->'tickets', 'cancelled_count', v_report->'cancelled',
    'sales_total', v_report->'total', 'average_ticket', v_report->'average',
    'products', coalesce((select jsonb_agg(jsonb_build_object('product_id', x->'productId',
      'product_name', x->'name', 'quantity', x->'qty', 'total', x->'total'))
      from jsonb_array_elements(v_report->'products') x), '[]'::jsonb),
    'payment_methods', coalesce((select jsonb_agg(jsonb_build_object('payment_method', x->'name',
      'orders', x->'count', 'total', x->'total')) from jsonb_array_elements(v_report->'paymentMethods') x), '[]'::jsonb),
    'order_types', coalesce((select jsonb_agg(jsonb_build_object('order_type', x->'name',
      'orders', x->'count', 'total', x->'total')) from jsonb_array_elements(v_report->'orderTypes') x), '[]'::jsonb),
    'stations', coalesce((select jsonb_agg(to_jsonb(st) order by st.total desc) from (
      select public.rc_ordera_normalize_station(coalesce(i.item->>'station', i.item #>> '{options_snapshot,station}')) as station,
        sum(greatest(public.rc_ordera_jsonb_numeric(coalesce(i.item->'qty', i.item->'quantity'), 1), 1)) as quantity,
        sum(case when coalesce(i.item->'lineTotal', i.item->'total_snapshot') is not null
          then public.rc_ordera_jsonb_numeric(coalesce(i.item->'lineTotal', i.item->'total_snapshot'), 0)
          else greatest(public.rc_ordera_jsonb_numeric(coalesce(i.item->'qty', i.item->'quantity'), 1), 1)
            * public.rc_ordera_jsonb_numeric(coalesce(i.item->'price', i.item->'unit_price_snapshot'), 0) end) as total
      from public.orders o cross join lateral jsonb_array_elements(
        case when jsonb_typeof(o.order_json->'items') = 'array' then o.order_json->'items' else '[]'::jsonb end) i(item)
      where o.user_id = v_owner_id and o.business_date >= v_start_date and o.business_date < v_end_date
        and coalesce(nullif(o.canonical_status, ''), nullif(o.status, ''), o.order_json->>'canonicalStatus', o.order_json->>'status', 'completed') not in ('cancelled', 'rejected')
      group by 1) st), '[]'::jsonb));

  return query
  insert into public.restaurant_period_closures (
    restaurant_user_id, period_type, period_start, period_end,
    report_snapshot, closed_by_user_id, closed_at
  ) values (v_owner_id, v_period_type, v_start_date, v_end_date - 1, v_report, v_owner_id, now())
  on conflict (restaurant_user_id, period_type, period_start)
  do update set report_snapshot = excluded.report_snapshot,
    period_end = excluded.period_end, closed_by_user_id = v_owner_id, closed_at = now()
  returning restaurant_period_closures.id, restaurant_period_closures.report_snapshot,
    restaurant_period_closures.closed_at;
end;
$function$
;
