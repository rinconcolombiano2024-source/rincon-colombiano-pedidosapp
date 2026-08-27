-- Ejecutar despues de MIGRACION-V88-01-SINCRONIZACION-MENU-PUBLICO.sql.
-- Todas las filas deben indicar ok = true y catalogos_desactualizados = 0.

select
  to_regclass('public.restaurant_public_catalogs') is not null as tabla_catalogo_publico_ok,
  to_regprocedure('public.save_current_restaurant_menu(jsonb,bigint)') is not null as rpc_guardar_menu_ok,
  to_regprocedure('public.get_public_restaurant_menu(uuid)') is not null as rpc_leer_menu_ok,
  to_regprocedure('public.rc_ordera_sync_public_restaurant_catalog()') is not null as trigger_function_ok;

select
  count(*) filter (where tgname = 'rc_ordera_sync_public_restaurant_catalog_insert') = 1 as trigger_insert_ok,
  count(*) filter (where tgname = 'rc_ordera_sync_public_restaurant_catalog_update') = 1 as trigger_update_ok,
  count(*) filter (where tgname = 'rc_ordera_sync_public_restaurant_catalog_delete') = 1 as trigger_delete_ok
from pg_catalog.pg_trigger
where tgrelid = 'public.app_settings'::regclass
  and not tgisinternal;

select exists (
  select 1
  from pg_catalog.pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'restaurant_public_catalogs'
) as realtime_catalogo_publico_ok;

select count(*) as catalogos_desactualizados
from public.app_settings s
left join public.restaurant_public_catalogs c
  on c.restaurant_user_id = s.user_id
where c.restaurant_user_id is null
   or c.menu is distinct from coalesce(s.menu, '{}'::jsonb)
   or c.menu_revision is distinct from greatest(coalesce(s.menu_revision, 1), 1);

select
  relrowsecurity as rls_habilitado,
  has_table_privilege('anon', 'public.restaurant_public_catalogs', 'SELECT') as anon_solo_lectura_disponible,
  not has_table_privilege('anon', 'public.restaurant_public_catalogs', 'INSERT') as anon_no_inserta,
  not has_table_privilege('anon', 'public.restaurant_public_catalogs', 'UPDATE') as anon_no_actualiza,
  not has_table_privilege('anon', 'public.restaurant_public_catalogs', 'DELETE') as anon_no_elimina
from pg_catalog.pg_class
where oid = 'public.restaurant_public_catalogs'::regclass;

select
  has_function_privilege('anon', 'public.get_public_restaurant_menu(uuid)', 'EXECUTE') as anon_puede_leer_menu,
  not has_function_privilege('anon', 'public.save_current_restaurant_menu(jsonb,bigint)', 'EXECUTE') as anon_no_puede_guardar_menu,
  has_function_privilege('authenticated', 'public.save_current_restaurant_menu(jsonb,bigint)', 'EXECUTE') as propietario_autenticado_puede_guardar;
