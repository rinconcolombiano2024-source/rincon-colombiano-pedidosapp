-- ============================================================
-- RC ORDERA V91-32
-- PGCRYPTO / DELIVERY QUOTE
--
-- Objetivo:
-- Versionar la correccion ya validada en produccion para
-- rc_ordera_create_delivery_quote().
--
-- La funcion utiliza:
--   - gen_random_bytes()
--   - digest()
--
-- En Supabase pgcrypto esta disponible mediante "extensions".
--
-- Produccion validada:
--   owner           = postgres
--   security definer = true
--   search_path      = pg_catalog, public, extensions
--   anon             = NO EXECUTE
--   authenticated    = NO EXECUTE
--   service_role     = EXECUTE
--
-- Incremental e idempotente.
-- No modifica pedidos.
-- No modifica cotizaciones existentes.
-- No modifica pagos.
-- No reemplaza el cuerpo de la funcion.
-- ============================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';


-- ============================================================
-- 1. PREFLIGHT
-- ============================================================

do $preflight$
begin

  if to_regprocedure(
    'public.rc_ordera_create_delivery_quote(uuid,uuid,text,text,text,numeric,numeric,integer,integer,text)'
  ) is null then

    raise exception
      'V91-32: falta public.rc_ordera_create_delivery_quote(uuid,uuid,text,text,text,numeric,numeric,integer,integer,text)';

  end if;


  if not exists (
    select 1
    from pg_catalog.pg_extension
    where extname = 'pgcrypto'
  ) then

    raise exception
      'V91-32: falta la extension pgcrypto';

  end if;

end;
$preflight$;



-- ============================================================
-- 2. CORRECCION QUIRURGICA
--
-- NO reemplazamos el cuerpo de la funcion.
-- Solo corregimos su search_path.
-- ============================================================

alter function
public.rc_ordera_create_delivery_quote(
  uuid,
  uuid,
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  integer,
  text
)
set search_path = pg_catalog, public, extensions;



-- ============================================================
-- 3. PERMISOS
--
-- Reproducimos el contrato validado en produccion.
-- ============================================================

revoke all on function
public.rc_ordera_create_delivery_quote(
  uuid,
  uuid,
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  integer,
  text
)
from public;

revoke all on function
public.rc_ordera_create_delivery_quote(
  uuid,
  uuid,
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  integer,
  text
)
from anon;

revoke all on function
public.rc_ordera_create_delivery_quote(
  uuid,
  uuid,
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  integer,
  text
)
from authenticated;

grant execute on function
public.rc_ordera_create_delivery_quote(
  uuid,
  uuid,
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  integer,
  text
)
to service_role;



-- ============================================================
-- 4. POSTCHECK
-- ============================================================

do $postcheck$
declare
  v_owner text;
  v_security_definer boolean;
  v_config text[];
begin

  select
    pg_catalog.pg_get_userbyid(p.proowner),
    p.prosecdef,
    p.proconfig
  into
    v_owner,
    v_security_definer,
    v_config
  from pg_catalog.pg_proc p
  where p.oid =
    'public.rc_ordera_create_delivery_quote(uuid,uuid,text,text,text,numeric,numeric,integer,integer,text)'
      ::regprocedure;


  if v_owner is distinct from 'postgres' then

    raise exception
      'V91-32 POSTCHECK: propietario inesperado: %',
      v_owner;

  end if;


  if v_security_definer is distinct from true then

    raise exception
      'V91-32 POSTCHECK: la funcion no es SECURITY DEFINER';

  end if;


  if not (
    coalesce(
      v_config,
      array[]::text[]
    )
    @>
    array[
      'search_path=pg_catalog, public, extensions'
    ]::text[]
  ) then

    raise exception
      'V91-32 POSTCHECK: search_path incorrecto: %',
      v_config;

  end if;


  if has_function_privilege(
    'anon',
    'public.rc_ordera_create_delivery_quote(uuid,uuid,text,text,text,numeric,numeric,integer,integer,text)',
    'EXECUTE'
  ) then

    raise exception
      'V91-32 SECURITY ERROR: anon conserva EXECUTE';

  end if;


  if has_function_privilege(
    'authenticated',
    'public.rc_ordera_create_delivery_quote(uuid,uuid,text,text,text,numeric,numeric,integer,integer,text)',
    'EXECUTE'
  ) then

    raise exception
      'V91-32 SECURITY ERROR: authenticated conserva EXECUTE';

  end if;


  if not has_function_privilege(
    'service_role',
    'public.rc_ordera_create_delivery_quote(uuid,uuid,text,text,text,numeric,numeric,integer,integer,text)',
    'EXECUTE'
  ) then

    raise exception
      'V91-32 SECURITY ERROR: service_role no tiene EXECUTE';

  end if;

end;
$postcheck$;


commit;
