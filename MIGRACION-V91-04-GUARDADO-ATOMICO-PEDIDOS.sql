-- RC ORDERA V91.04
-- Revision optimista + guardado/publicacion atomica de pedidos.
-- Incremental e idempotente.
-- No elimina pedidos, tickets ni historicos.

begin;


-- ============================================================
-- PREFLIGHT
-- ============================================================

do $preflight$
begin

  if to_regclass('public.orders') is null then
    raise exception
      'Falta public.orders. Ejecuta primero las migraciones anteriores.';
  end if;

  if to_regprocedure(
    'public.publish_current_restaurant_order_to_stations(uuid,uuid)'
  ) is null then
    raise exception
      'Falta publish_current_restaurant_order_to_stations(uuid,uuid). Ejecuta primero V85-02 y las migraciones posteriores.';
  end if;

end;
$preflight$;


-- ============================================================
-- 1. REVISION DE PEDIDOS
-- ============================================================

alter table public.orders
  add column if not exists revision bigint;


-- Pedidos historicos existentes comienzan en revision 1.
update public.orders
set revision = 1
where revision is null
   or revision < 1;


alter table public.orders
  alter column revision set default 1,
  alter column revision set not null;


-- ============================================================
-- 2. REVISION CENTRALIZADA
--
-- La revision pertenece a la TABLA, no a una RPC concreta.
--
-- INSERT  -> revision 1
-- UPDATE  -> revision anterior + 1
--
-- Esto cubre:
-- - caja
-- - cancelaciones
-- - pedidos QR
-- - futuras funciones que actualicen orders
-- ============================================================

create or replace function public.rc_ordera_set_order_revision()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin

  if tg_op = 'INSERT' then
    new.revision := 1;
    return new;
  end if;


  new.revision :=
    greatest(
      coalesce(old.revision, 1),
      1
    ) + 1;


  return new;

end;
$$;


drop trigger if exists
  rc_ordera_set_order_revision
on public.orders;


create trigger rc_ordera_set_order_revision
before insert or update
on public.orders
for each row
execute function public.rc_ordera_set_order_revision();


-- ============================================================
-- 3. GUARDAR + PUBLICAR PEDIDO ATOMICAMENTE
-- ============================================================

create or replace function public.save_and_publish_restaurant_order_atomic(

  p_id uuid,

  p_ticket_number integer,

  p_business_date date,

  p_order_json jsonb,

  p_total numeric,

  p_created_at timestamptz,

  p_customer_order_id uuid,

  p_expected_revision bigint

)
returns table (

  order_id uuid,

  revision bigint,

  customer_order_id uuid,

  updated_at timestamptz

)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare

  v_actor uuid := auth.uid();

  v_existing public.orders%rowtype;

  v_revision bigint;

  v_customer_order_id uuid;

  v_updated_at timestamptz;

begin


  -- ==========================================================
  -- AUTENTICACION
  -- ==========================================================

  if v_actor is null then
    raise exception 'Not authenticated';
  end if;


  -- ==========================================================
  -- VALIDACIONES
  -- ==========================================================

  if p_id is null then
    raise exception 'Order id is required';
  end if;


  if p_ticket_number is null
     or p_ticket_number < 1 then

    raise exception 'Invalid ticket number';

  end if;


  if p_business_date is null then
    raise exception 'Business date is required';
  end if;


  if p_order_json is null then
    raise exception 'Order JSON is required';
  end if;


  -- ==========================================================
  -- BLOQUEAR PEDIDO EXISTENTE
  --
  -- FOR UPDATE evita que dos cajas modifiquen simultaneamente
  -- la misma revision.
  -- ==========================================================

  select o.*
  into v_existing

  from public.orders o

  where o.id = p_id
    and o.user_id = v_actor

  for update;


  -- ==========================================================
  -- PEDIDO EXISTENTE
  -- ==========================================================

  if found then


    -- Para modificar un pedido existente el dispositivo
    -- debe conocer obligatoriamente su revision actual.

    if p_expected_revision is null then
      raise exception 'ORDER_REVISION_REQUIRED';
    end if;


    -- Otro dispositivo ya modifico el pedido.

    if p_expected_revision <> v_existing.revision then

      raise exception 'ORDER_REVISION_CONFLICT'
        using errcode = '40001';

    end if;


    update public.orders as o

    set

      ticket_number = p_ticket_number,

      business_date = p_business_date,

      order_json = p_order_json,

      total = coalesce(p_total, 0),

      updated_at = now()

    where o.id = p_id
      and o.user_id = v_actor

    returning
      o.revision,
      o.updated_at

    into
      v_revision,
      v_updated_at;


    if not found then
      raise exception 'Order update was not persisted';
    end if;


  -- ==========================================================
  -- PEDIDO NUEVO
  -- ==========================================================

  else


    -- Si el navegador envia revision para un pedido que no
    -- existe en servidor, no debemos recrearlo silenciosamente.

    if p_expected_revision is not null then

      raise exception 'ORDER_REVISION_CONFLICT'
        using errcode = '40001';

    end if;


    insert into public.orders as o (

      id,

      user_id,

      ticket_number,

      business_date,

      order_json,

      total,

      created_at,

      updated_at

    )
    values (

      p_id,

      v_actor,

      p_ticket_number,

      p_business_date,

      p_order_json,

      coalesce(p_total, 0),

      coalesce(
        p_created_at,
        now()
      ),

      now()

    )

    returning
      o.revision,
      o.updated_at

    into
      v_revision,
      v_updated_at;


  end if;


  -- ==========================================================
  -- PUBLICAR A COCINA / BEBIDAS / ESTACIONES
  --
  -- IMPORTANTE:
  -- Sigue dentro de la MISMA transaccion PostgreSQL.
  --
  -- Si publicar falla:
  -- tambien se revierte el guardado del pedido.
  -- ==========================================================

  v_customer_order_id :=

    public.publish_current_restaurant_order_to_stations(

      p_id,

      p_customer_order_id

    );


  if v_customer_order_id is null then

    raise exception
      'Order station publication was not confirmed';

  end if;


  -- ==========================================================
  -- CONFIRMACION AL FRONTEND
  -- ==========================================================

  return query

  select

    p_id,

    v_revision,

    v_customer_order_id,

    v_updated_at;


end;
$$;


-- ============================================================
-- 4. SEGURIDAD
-- ============================================================

revoke all
on function public.save_and_publish_restaurant_order_atomic(

  uuid,

  integer,

  date,

  jsonb,

  numeric,

  timestamptz,

  uuid,

  bigint

)
from public, anon;


grant execute
on function public.save_and_publish_restaurant_order_atomic(

  uuid,

  integer,

  date,

  jsonb,

  numeric,

  timestamptz,

  uuid,

  bigint

)
to authenticated;


commit;
