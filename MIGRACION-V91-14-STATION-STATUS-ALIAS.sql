-- Correccion localizada de 42702. No modifica permisos, estados ni triggers.
-- Idempotente: conserva literalmente el resto de la definicion instalada.
begin;
do $migration$
declare
  v_definition text;
  v_before text;
  v_after text;
  v_condition text;
begin
  select pg_get_functiondef(
    'public.update_my_station_order(uuid,uuid,text,text)'::regprocedure
  ) into v_definition;

  foreach v_condition in array array[
    'in (''ready'', ''packed'')',
    '= ''dispatched'''
  ] loop
    v_before := case when v_condition = '= ''dispatched''' then
      E'      update public.customer_orders\n      set station_status = ''completed'', status = ''delivered'', updated_at = now()'
    else
      E'      update public.customer_orders\n      set station_status = ''dispatched'', status = ''sent'', updated_at = now()'
    end || E'\n      where id = p_order_id\n        and user_id = p_restaurant_user_id\n        and station_status ' || v_condition || ';';
    v_after := replace(v_before,
      'update public.customer_orders', 'update public.customer_orders as dispatch_order');
    v_after := replace(v_after, 'where id =', 'where dispatch_order.id =');
    v_after := replace(v_after, 'and user_id =', 'and dispatch_order.user_id =');
    v_after := replace(v_after, 'and station_status ', 'and dispatch_order.station_status ');

    if strpos(v_definition, v_before) > 0 then
      v_definition := replace(v_definition, v_before, v_after);
    elsif strpos(v_definition, v_after) = 0 then
      raise exception 'V91-14: definicion no reconocida; no se modifico update_my_station_order';
    end if;
  end loop;
  execute v_definition;
end;
$migration$;
commit;
