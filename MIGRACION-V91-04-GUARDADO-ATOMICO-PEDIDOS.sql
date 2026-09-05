-- RC ORDERA V91.04
-- Guardado atomico de pedidos del restaurante con control de revision.
-- Incremental e idempotente.
-- No elimina pedidos, tickets ni historicos.

begin;


-- ============================================================
-- 1. PREFLIGHT
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
      'Falta publish_current_restaurant_order_to_stations. Ejecuta primero V85.02 y las migraciones posteriores.';
  end if;
end;
$preflight$;


-- ============================================================
-- 2. REVISION OPTIMISTA DE PEDIDOS
-- ============================================================

alter table public.orders
  add column if not exists revision bigint;


update public.orders
set revision = 1
where revision is null
   or revision < 1;


alter table public.orders
  alter column revision set default 1;


alter table public.orders
  alter column revision set not null;


-- ============================================================
-- 3. GUARDADO + PUBLICACION ATOMICA
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

  v_now timestamptz := now();
begin

  -- ----------------------------------------------------------
  -- Seguridad
  -- ----------------------------------------------------------

  if v_actor is null then
    raise exception 'Not authenticated';
  end if;


  -- ----------------------------------------------------------
  -- Validaciones basicas
  -- ----------------------------------------------------------

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


  -- ----------------------------------------------------------
  -- Buscar el pedido y bloquearlo durante la transaccion
  -- ----------------------------------------------------------

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

    -- Nunca permitir que un dispositivo sobrescriba
    -- silenciosamente una version que no conoce.
    if p_expected_revision is null then
      raise exception 'ORDER_REVISION_REQUIRED';
    end if;


    if p_expected_revision <> v_existing.revision then
      raise exception 'ORDER_REVISION_CONFLICT'
        using errcode = '40001';
    end if;


    update public.orders o
    set
      ticket_number = p_ticket_number,

      business_date = p_business_date,

      order_json = p_order_json,

      total = coalesce(p_total, 0),

      revision = v_existing.revision + 1,

      updated_at = v_now

    where o.id = p_id
      and o.user_id = v_actor

    returning o.revision
    into v_revision;


    if not found then
      raise exception 'Order update was not persisted';
    end if;


  -- ==========================================================
  -- PEDIDO NUEVO
  -- ==========================================================

  else

    -- Si el navegador afirma conocer una revision de un pedido
    -- que no existe, no crear otro silenciosamente.
    if p_expected_revision is not null then
      raise exception 'ORDER_REVISION_CONFLICT'
        using errcode = '40001';
    end if;


    insert into public.orders (
      id,
      user_id,
      ticket_number,
      business_date,
      order_json,
      total,
      revision,
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
      1,
      coalesce(p_created_at, v_now),
      v_now
    )

    returning orders.revision
    into v_revision;

  end if;


  -- ==========================================================
  -- PUBLICAR A ESTACIONES
  --
  -- Se ejecuta dentro de LA MISMA transaccion.
  -- Si publicar falla, guardar tambien se revierte.
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
  -- RESPUESTA CONFIRMADA AL CLIENTE
  -- ==========================================================

  return query
  select
    p_id,
    v_revision,
    v_customer_order_id,
    v_now;

end;
$$;


-- ============================================================
-- 4. PERMISOS
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
