-- V91-12C: cierre quirurgico de escritura directa sobre delivery_assignments.
-- Prerrequisito de V91-13 P0-01.
-- No cambia RLS, estados, datos, pagos, tokens ni funciones existentes.

begin;
set local lock_timeout = '5s';

-- El flujo valido de escritura debe pasar por update_delivery_assignment_status(...).
revoke insert, update, delete
on table public.delivery_assignments
from anon, authenticated;

-- Postcondiciones: sin DML directo para navegador, lectura autenticada y RPC legitima conservadas.
do $verify$
begin
  if has_any_column_privilege('anon', 'public.delivery_assignments', 'INSERT, UPDATE')
     or has_table_privilege('anon', 'public.delivery_assignments', 'DELETE') then
    raise exception 'V91-12C: anon conserva DML directo en delivery_assignments';
  end if;

  if has_any_column_privilege('authenticated', 'public.delivery_assignments', 'INSERT, UPDATE')
     or has_table_privilege('authenticated', 'public.delivery_assignments', 'DELETE') then
    raise exception 'V91-12C: authenticated conserva DML directo en delivery_assignments';
  end if;

  if not has_table_privilege('authenticated', 'public.delivery_assignments', 'SELECT') then
    raise exception 'V91-12C: se perdio SELECT authenticated sobre delivery_assignments';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.update_delivery_assignment_status(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'V91-12C: se perdio EXECUTE authenticated sobre update_delivery_assignment_status';
  end if;

  if has_function_privilege(
    'anon',
    'public.update_delivery_assignment_status(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'V91-12C: anon puede ejecutar update_delivery_assignment_status';
  end if;
end;
$verify$;

commit;
