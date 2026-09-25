-- Optimiza solo busqueda del producto. Conserva validaciones/precios server-side.
begin;
do $patch$
declare definition text; previous text; replacement text;
begin
  select replace(pg_get_functiondef('public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)'::regprocedure), E'\r\n', E'\n') into definition;
  if strpos(definition,'v_menu_lookup_v22') > 0 then return; end if;
  if strpos(definition,'  v_menu_item jsonb;')=0 then raise exception 'V91-22: declaracion desconocida'; end if;
  definition := replace(definition,'  v_menu_item jsonb;',E'  v_menu_item jsonb;\n  v_menu_lookup_v22 jsonb;\n  v_requested_ids_v22 text[];');
  previous := '  for v_requested_item in select value from jsonb_array_elements(p_order_json->''items'')';
  replacement := $body$
  select array_agg(trim(coalesce(item->>'product_id',''))) into v_requested_ids_v22
  from jsonb_array_elements(p_order_json->'items') item;
  select coalesce(jsonb_object_agg(found.product_id,found.value),'{}'::jsonb) into v_menu_lookup_v22
  from (
    select distinct on (trim(coalesce(dish.value->>'id','')))
      trim(coalesce(dish.value->>'id','')) as product_id, dish.value
    from jsonb_each(v_menu) with ordinality category
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(category.value)='array' then category.value else '[]'::jsonb end
    ) with ordinality dish
    where trim(coalesce(dish.value->>'id','')) = any(v_requested_ids_v22)
    order by trim(coalesce(dish.value->>'id','')), category.ordinality, dish.ordinality
  ) found;
  for v_requested_item in select value from jsonb_array_elements(p_order_json->'items')$body$;
  if strpos(definition,previous)=0 then raise exception 'V91-22: bucle desconocido'; end if;
  definition := replace(definition,previous,replacement);
  previous := $body$    select dish.value into v_menu_item
    from jsonb_each(v_menu) category
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(category.value) = 'array' then category.value else '[]'::jsonb end
    ) dish
    where trim(coalesce(dish.value->>'id', '')) = v_product_id
    limit 1;$body$;
  if strpos(definition,previous)=0 then raise exception 'V91-22: busqueda desconocida'; end if;
  definition := replace(definition,previous,'    v_menu_item := v_menu_lookup_v22->v_product_id;');
  execute definition;
end;
$patch$;
commit;
