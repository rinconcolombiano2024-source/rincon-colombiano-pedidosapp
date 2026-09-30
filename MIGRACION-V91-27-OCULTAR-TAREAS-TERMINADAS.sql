-- RC ORDERA V91-27
-- P1: una tarea terminada en una estacion de preparacion no debe seguir visible.
-- Aplicar despues de V91-21/V91-26. No modifica pedidos, importes, pagos ni historicos.
-- Corrige tanto la lectura completa como la lectura delta usada por Realtime.

begin;
set local lock_timeout = '5s';

do $migration$
declare
  v_signature text;
  v_proc regprocedure;
  v_def text;
  v_old constant text := 'task.status not in (''blocked'', ''packed'', ''cancelled'')';
  v_new constant text := 'task.status not in (''blocked'', ''ready'', ''packed'', ''cancelled'')';
begin
  -- Preflight: las dos firmas deben existir antes de modificar nada.
  foreach v_signature in array array[
    'public.list_my_station_orders(uuid,text)',
    'public.list_my_station_orders(uuid,text,uuid[])'
  ] loop
    v_proc := to_regprocedure(v_signature);
    if v_proc is null then
      raise exception 'V91-27: falta %. No se modifico nada.', v_signature;
    end if;

    select replace(pg_get_functiondef(v_proc), E'\r\n', E'\n')
      into v_def;

    if position(v_new in v_def) = 0 and position(v_old in v_def) = 0 then
      raise exception 'V91-27: contrato inesperado en %. No se modifico nada.', v_signature;
    end if;
  end loop;

  -- Parche idempotente de ambas rutas: full read + delta/Reatime.
  foreach v_signature in array array[
    'public.list_my_station_orders(uuid,text)',
    'public.list_my_station_orders(uuid,text,uuid[])'
  ] loop
    v_proc := to_regprocedure(v_signature);

    select replace(pg_get_functiondef(v_proc), E'\r\n', E'\n')
      into v_def;

    if position(v_new in v_def) > 0 then
      continue;
    end if;

    v_def := replace(v_def, v_old, v_new);
    execute v_def;
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';
commit;

-- Verificacion manual posterior:
-- Ambas filas deben devolver true.
select
  p.oid::regprocedure::text as function_name,
  position(
    'task.status not in (''blocked'', ''ready'', ''packed'', ''cancelled'')'
    in pg_get_functiondef(p.oid)
  ) > 0 as finished_tasks_hidden
from pg_proc p
where p.oid in (
  'public.list_my_station_orders(uuid,text)'::regprocedure,
  'public.list_my_station_orders(uuid,text,uuid[])'::regprocedure
)
order by 1;
