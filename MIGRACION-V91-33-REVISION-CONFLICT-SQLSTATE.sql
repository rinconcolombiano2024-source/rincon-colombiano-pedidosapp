-- ============================================================
-- RC ORDERA V91-33
-- ORDER REVISION CONFLICT / SQLSTATE
--
-- Problema:
--
-- ORDER_REVISION_CONFLICT es un conflicto logico de
-- concurrencia optimista de RC ORDERA.
--
-- No es una serialization_failure PostgreSQL.
--
-- SQLSTATE 40001 esta reservado para serialization_failure
-- y puede ser interpretado como un error automaticamente
-- reintentable por clientes, drivers o infraestructura.
--
-- Objetivo:
--
-- Mantener exactamente la proteccion de revision,
-- pero devolver P0001 para el conflicto de negocio.
--
-- NO elimina FOR UPDATE.
-- NO permite sobreescrituras.
-- NO modifica pedidos.
-- NO modifica revisiones.
-- NO modifica pagos.
-- NO modifica historicos.
-- ============================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';


-- ============================================================
-- 1. PREFLIGHT
-- ============================================================

do $preflight$
declare
  v_proc regprocedure;
  v_definition text;
  v_old_count integer;
begin

  v_proc :=
    to_regprocedure(
      'public.save_and_publish_restaurant_order_atomic(uuid,integer,date,jsonb,numeric,timestamptz,uuid,bigint)'
    );

  if v_proc is null then
    raise exception
      'V91-33: falta save_and_publish_restaurant_order_atomic';
  end if;


  select pg_get_functiondef(v_proc)
  into v_definition;


  /*
   * V91-04 contiene exactamente DOS conflictos
   * logicos declarados como SQLSTATE 40001:
   *
   * 1. revision esperada != revision servidor
   * 2. pedido inexistente + expected_revision enviado
   *
   * Si la definición no coincide, abortamos.
   */

  v_old_count :=
    (
      length(v_definition)
      -
      length(
        replace(
          v_definition,
          'using errcode = ''40001''',
          ''
        )
      )
    )
    /
    length(
      'using errcode = ''40001'''
    );


  if v_old_count <> 2 then
    raise exception
      'V91-33 PRECHECK: se esperaban 2 usos de SQLSTATE 40001 y se encontraron %',
      v_old_count;
  end if;


  if position(
    'ORDER_REVISION_CONFLICT'
    in v_definition
  ) = 0 then
    raise exception
      'V91-33 PRECHECK: contrato ORDER_REVISION_CONFLICT no encontrado';
  end if;

end;
$preflight$;



-- ============================================================
-- 2. PATCH QUIRURGICO
-- ============================================================

do $patch$
declare
  v_proc regprocedure;
  v_definition text;
begin

  v_proc :=
    'public.save_and_publish_restaurant_order_atomic(uuid,integer,date,jsonb,numeric,timestamptz,uuid,bigint)'
      ::regprocedure;


  select pg_get_functiondef(v_proc)
  into v_definition;


  v_definition :=
    replace(
      v_definition,
      'using errcode = ''40001''',
      'using errcode = ''P0001'''
    );


  execute v_definition;

end;
$patch$;



-- ============================================================
-- 3. POSTCHECK
-- ============================================================

do $postcheck$
declare
  v_proc regprocedure;
  v_definition text;
  v_old_count integer;
  v_new_count integer;
begin

  v_proc :=
    'public.save_and_publish_restaurant_order_atomic(uuid,integer,date,jsonb,numeric,timestamptz,uuid,bigint)'
      ::regprocedure;


  select pg_get_functiondef(v_proc)
  into v_definition;


  v_old_count :=
    (
      length(v_definition)
      -
      length(
        replace(
          v_definition,
          'using errcode = ''40001''',
          ''
        )
      )
    )
    /
    length(
      'using errcode = ''40001'''
    );


  v_new_count :=
    (
      length(v_definition)
      -
      length(
        replace(
          v_definition,
          'using errcode = ''P0001''',
          ''
        )
      )
    )
    /
    length(
      'using errcode = ''P0001'''
    );


  if v_old_count <> 0 then
    raise exception
      'V91-33 POSTCHECK: todavía existen % usos de 40001',
      v_old_count;
  end if;


  if v_new_count <> 2 then
    raise exception
      'V91-33 POSTCHECK: se esperaban 2 usos de P0001 y se encontraron %',
      v_new_count;
  end if;


  if position(
    'ORDER_REVISION_CONFLICT'
    in v_definition
  ) = 0 then
    raise exception
      'V91-33 POSTCHECK: se perdió ORDER_REVISION_CONFLICT';
  end if;


  if not has_function_privilege(
    'authenticated',
    v_proc::oid,
    'EXECUTE'
  ) then
    raise exception
      'V91-33 SECURITY: authenticated perdió EXECUTE';
  end if;


  if has_function_privilege(
    'anon',
    v_proc::oid,
    'EXECUTE'
  ) then
    raise exception
      'V91-33 SECURITY: anon tiene EXECUTE';
  end if;

end;
$postcheck$;


notify pgrst, 'reload schema';

commit;
