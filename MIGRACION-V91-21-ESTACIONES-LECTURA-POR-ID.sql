-- Firma adicional: mismos permisos, columnas y filtros; no cambia RPC anterior.
begin;
do $patch$
declare definition text;
begin
  select replace(pg_get_functiondef('public.list_my_station_orders(uuid,text)'::regprocedure), E'\r\n', E'\n') into definition;
  if strpos(definition,'p_station text)') = 0
    or strpos(definition,'where task.restaurant_user_id = p_restaurant_user_id') = 0
    or strpos(definition,'where co.user_id = p_restaurant_user_id') = 0 then
    raise exception 'V91-21: contrato de estaciones desconocido';
  end if;
  definition := replace(definition,'p_station text)','p_station text, p_order_ids uuid[])');
  definition := replace(definition, E'begin\n', E'begin\n  if p_order_ids is null or cardinality(p_order_ids) > 100 then\n    raise exception ''Invalid station order batch'' using errcode = ''22023'';\n  end if;\n');
  definition := replace(definition,'where task.restaurant_user_id = p_restaurant_user_id',
    'where task.customer_order_id = any(p_order_ids) and task.restaurant_user_id = p_restaurant_user_id');
  definition := replace(definition,'where co.user_id = p_restaurant_user_id',
    'where co.id = any(p_order_ids) and co.user_id = p_restaurant_user_id');
  execute definition;
end;
$patch$;
revoke all on function public.list_my_station_orders(uuid,text,uuid[]) from public,anon;
grant execute on function public.list_my_station_orders(uuid,text,uuid[]) to authenticated;
commit;
