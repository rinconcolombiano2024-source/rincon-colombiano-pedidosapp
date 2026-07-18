-- Fase 2: activar Supabase Realtime para el menu actual.
-- Esta migracion no borra tablas ni datos.
-- Ejecutar en Supabase SQL Editor si ya tienes el esquema principal creado.

alter table public.app_settings replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end;
$$;
