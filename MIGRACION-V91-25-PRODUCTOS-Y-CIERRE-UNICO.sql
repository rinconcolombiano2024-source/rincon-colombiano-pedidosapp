-- Aplicar despues de V91-24. No modifica cierres historicos ni importes de pedidos.
-- Conserva ACL, firma y autorizacion de ambos RPC. Reejecutable.
begin;
do $migration$
declare
  v_def text;
  v_old text;
  v_new text;
  v_start integer;
  v_end integer;
begin
  select pg_get_functiondef('public.get_restaurant_closure_report(text,text)'::regprocedure) into v_def;
  if position('v91_25_product_identity' in v_def) = 0 then
    v_old := 's.business_date,';
    v_new := $fragment$s.business_date,
      -- v91_25_product_identity: el ID de linea nunca es el ID de producto.
      coalesce(nullif(trim(i.item->>'productId'), ''), nullif(trim(i.item->>'product_id'), '')) as product_id,$fragment$;
    if position(v_old in v_def) = 0 or position('from items group by product_name' in v_def) = 0
       or position('effective_status <> ''cancelled''' in v_def) = 0 then
      raise exception 'V91-25: contrato de reporte inesperado; no se modifico';
    end if;
    -- Solo la primera aparicion pertenece a la CTE items.
    v_start := position(v_old in v_def);
    v_def := substr(v_def, 1, v_start - 1) || v_new || substr(v_def, v_start + length(v_old));
    v_def := replace(v_def, 'effective_status <> ''cancelled''', 'effective_status not in (''cancelled'', ''rejected'')');
    v_def := replace(v_def, 'effective_status = ''cancelled''', 'effective_status in (''cancelled'', ''rejected'')');
    v_def := replace(v_def,
      '''name'', p.product_name, ''qty'', p.qty',
      '''name'', p.product_name, ''productId'', p.product_id, ''qty'', p.qty');
    v_def := replace(v_def,
      'select product_name, sum(qty) qty, sum(line_total) total from items group by product_name',
      'select product_id, min(product_name) product_name, sum(qty) qty, sum(line_total) total from items group by product_id, case when product_id is null then product_name end');
    execute v_def;
  end if;

  select pg_get_functiondef('public.close_current_restaurant_period(text,date)'::regprocedure) into v_def;
  if position('v91_25_single_report' in v_def) = 0 then
    v_start := position('  with period_orders as (' in v_def);
    v_end := position('  return query' in v_def);
    if v_start = 0 or v_end <= v_start or position('Restaurant owner profile is missing' in v_def) = 0 then
      raise exception 'V91-25: contrato de cierre inesperado; no se modifico';
    end if;
    v_new := $fragment$  -- v91_25_single_report: mismo motor y estados que el reporte visible.
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

$fragment$;
    execute substr(v_def, 1, v_start - 1) || v_new || substr(v_def, v_end);
  end if;
end;
$migration$;
commit;
