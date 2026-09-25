-- V91-22 corregida.
-- Optimiza solamente la búsqueda del producto.
-- Conserva validaciones, precios server-side, ACL y comportamiento existente.
-- Valida product_id ANTES de construir el lookup del menú.

begin;

do $patch$
declare
  definition text;
  previous text;
  replacement text;
begin

  select replace(
    pg_get_functiondef(
      'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)'::regprocedure
    ),
    E'\r\n',
    E'\n'
  )
  into definition;

  -- Idempotencia.
  if strpos(definition, 'v_menu_lookup_v22') > 0 then
    return;
  end if;

  if strpos(definition, '  v_menu_item jsonb;') = 0 then
    raise exception 'V91-22: declaracion desconocida';
  end if;

  definition := replace(
    definition,
    '  v_menu_item jsonb;',
    E'  v_menu_item jsonb;\n  v_menu_lookup_v22 jsonb;\n  v_requested_ids_v22 text[];'
  );

  previous :=
    '  for v_requested_item in select value from jsonb_array_elements(p_order_json->''items'')';

  replacement := $body$
  -- V91-22: validar IDs ANTES de construir el lookup.
  -- Evita recorrer el menu o reservar estructuras innecesarias
  -- para entradas anonimas malformadas.
  if exists (
    select 1
    from jsonb_array_elements(p_order_json->'items') item
    where trim(coalesce(item->>'product_id', '')) = ''
       or length(trim(coalesce(item->>'product_id', ''))) > 200
  ) then
    raise exception 'Invalid product';
  end if;

  select array_agg(
    trim(coalesce(item->>'product_id', ''))
  )
  into v_requested_ids_v22
  from jsonb_array_elements(p_order_json->'items') item;

  select coalesce(
    jsonb_object_agg(found.product_id, found.value),
    '{}'::jsonb
  )
  into v_menu_lookup_v22
  from (
    select distinct on (
      trim(coalesce(dish.value->>'id', ''))
    )
      trim(coalesce(dish.value->>'id', '')) as product_id,
      dish.value
    from jsonb_each(v_menu) with ordinality category
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(category.value) = 'array'
          then category.value
        else '[]'::jsonb
      end
    ) with ordinality dish
    where trim(coalesce(dish.value->>'id', ''))
          = any(v_requested_ids_v22)
    order by
      trim(coalesce(dish.value->>'id', '')),
      category.ordinality,
      dish.ordinality
  ) found;

  for v_requested_item
  in select value
     from jsonb_array_elements(p_order_json->'items')$body$;

  if strpos(definition, previous) = 0 then
    raise exception 'V91-22: bucle desconocido';
  end if;

  definition := replace(
    definition,
    previous,
    replacement
  );

  previous := $body$    select dish.value into v_menu_item
    from jsonb_each(v_menu) category
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(category.value) = 'array' then category.value else '[]'::jsonb end
    ) dish
    where trim(coalesce(dish.value->>'id', '')) = v_product_id
    limit 1;$body$;

  if strpos(definition, previous) = 0 then
    raise exception 'V91-22: busqueda desconocida';
  end if;

  definition := replace(
    definition,
    previous,
    '    v_menu_item := v_menu_lookup_v22->v_product_id;'
  );

  execute definition;

end;
$patch$;

commit;
