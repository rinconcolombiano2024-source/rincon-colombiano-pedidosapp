-- Corrige exclusivamente el agregado mensual del informe de cierre.
-- El RPC existente consulta TODOS los pedidos del periodo, no la cache del POS.
-- No cambia firmas, permisos, filtros, ventas, datos ni migraciones anteriores.
begin;

do $closure_fix$
declare
  v_oid oid := to_regprocedure('public.get_restaurant_closure_report(text,text)');
  v_definition text;
  v_old_items text := $old$coalesce((select sum(i.qty) from items i where to_char(i.business_date, 'YYYY-MM') = to_char(s.business_date, 'YYYY-MM')), 0) items,$old$;
  v_old_json text := $old$'items', m.items,$old$;
  v_new_json text := $new$'items', coalesce((select sum(i.qty) from items i where to_char(i.business_date, 'YYYY-MM') = m.month_key), 0),$new$;
begin
  if v_oid is null then
    raise exception 'Falta get_restaurant_closure_report(text,text). Aplicar primero V91-01.';
  end if;
  v_definition := pg_get_functiondef(v_oid);
  if position(v_old_items in v_definition) = 0
     and position(v_old_json in v_definition) = 0
     and position(v_new_json in v_definition) > 0 then
    return; -- Ya aplicado.
  end if;
  if position(v_old_items in v_definition) = 0
     or position(v_old_json in v_definition) = 0
     or (length(v_definition) - length(replace(v_definition, v_old_items, ''))) <> length(v_old_items)
     or (length(v_definition) - length(replace(v_definition, v_old_json, ''))) <> length(v_old_json) then
    raise exception 'Definicion de cierre distinta de la esperada; no se modifica automaticamente.';
  end if;
  -- La subconsulta usa ahora la clave de mes YA agrupada, no s.business_date
  -- desde un nivel exterior sin agrupar (PostgreSQL 42803).
  v_definition := replace(v_definition, v_old_items, '');
  v_definition := replace(v_definition, v_old_json, v_new_json);
  execute v_definition;
end;
$closure_fix$;

commit;
