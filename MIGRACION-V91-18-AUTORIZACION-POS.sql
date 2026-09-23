BEGIN;

-- ============================================================
-- V91-18
-- AUTORIZACION POS ADAPTADA AL CONTRATO REAL DE PRODUCCION
-- No cambia importes, pagos, estaciones ni logica funcional.
-- ============================================================


-- ============================================================
-- 1. SAVE + PUBLISH
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_and_publish_restaurant_order_atomic(
  p_id uuid,
  p_ticket_number integer,
  p_business_date date,
  p_order_json jsonb,
  p_total numeric,
  p_created_at timestamptz,
  p_customer_order_id uuid DEFAULT NULL::uuid,
  p_expected_revision bigint DEFAULT NULL::bigint
)
RETURNS TABLE(
  order_id uuid,
  revision bigint,
  server_updated_at timestamptz
)
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_order_id uuid;
  v_revision bigint;
  v_server_updated_at timestamptz;
begin

  if v_actor is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  -- V91-18: POS del propietario.
  -- No exige que el restaurante este operational_open.
  if not exists (
    select 1
    from public.restaurant_profiles rp
    where rp.user_id = v_actor
      and rp.active = true
      and rp.deleted_at is null
  ) then
    raise exception 'Restaurant is not authorized'
      using errcode = '42501';
  end if;

  select
    saved.order_id,
    saved.revision,
    saved.server_updated_at
  into
    v_order_id,
    v_revision,
    v_server_updated_at
  from public.save_restaurant_order_atomic(
    p_id,
    p_ticket_number,
    p_business_date,
    p_order_json,
    p_total,
    p_created_at,
    p_expected_revision
  ) as saved;

  perform public.publish_current_restaurant_order_to_stations(
    p_id,
    p_customer_order_id
  );

  return query
  select
    v_order_id,
    v_revision,
    v_server_updated_at;
end;
$function$;


-- ============================================================
-- 2. PUBLICACION A ESTACIONES
-- ============================================================

CREATE OR REPLACE FUNCTION public.publish_current_restaurant_order_to_stations(
  p_restaurant_order_id uuid,
  p_customer_order_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_owner_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_customer_order_id uuid;
  v_items jsonb;
begin

  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;

  -- V91-18: solo propietario de restaurante activo/no eliminado.
  -- El POS sigue funcionando aunque el local este cerrado al publico.
  if not exists (
    select 1
    from public.restaurant_profiles rp
    where rp.user_id = v_owner_id
      and rp.active = true
      and rp.deleted_at is null
  ) then
    raise exception 'Restaurant is not authorized'
      using errcode = '42501';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_restaurant_order_id
    and o.user_id = v_owner_id;

  if not found then
    raise exception 'Restaurant order was not found';
  end if;

  v_items := coalesce(
    v_order.order_json->'items',
    '[]'::jsonb
  );

  if p_customer_order_id is not null then

    update public.customer_orders co
    set
      restaurant_order_id = v_order.id,
      status =
        case
          when co.status = 'pending' then 'accepted'
          else co.status
        end,
      station_status =
        case
          when co.station_status in ('cancelled', 'completed')
            then co.station_status
          else 'received'
        end,
      order_json =
        co.order_json || jsonb_build_object(
          'items',
          v_items,
          'serverName',
          coalesce(
            nullif(v_order.order_json->>'server', ''),
            co.server_name,
            'Caja'
          )
        ),
      updated_at = now()
    where co.id = p_customer_order_id
      and co.user_id = v_owner_id
    returning co.id
    into v_customer_order_id;

    if v_customer_order_id is null then
      raise exception
        'Customer order does not belong to this restaurant';
    end if;

  else

    select co.id
    into v_customer_order_id
    from public.customer_orders co
    where co.user_id = v_owner_id
      and co.restaurant_order_id = v_order.id
    limit 1;

    if v_customer_order_id is null then

      insert into public.customer_orders (
        id,
        user_id,
        customer_user_id,
        status,
        table_label,
        customer_name,
        order_type,
        order_json,
        total,
        restaurant_order_id,
        source,
        created_by_user_id,
        server_name,
        station_status,
        created_at,
        updated_at
      )
      values (
        v_order.id,
        v_owner_id,
        null,
        'accepted',
        left(
          coalesce(v_order.order_json->>'customer', ''),
          160
        ),
        '',
        coalesce(
          nullif(v_order.order_json->>'type', ''),
          'Comer en el punto'
        ),
        v_order.order_json || jsonb_build_object(
          'items',
          v_items,
          'source',
          'pos'
        ),
        v_order.total,
        v_order.id,
        'pos',
        v_owner_id,
        left(
          coalesce(
            nullif(v_order.order_json->>'server', ''),
            'Caja'
          ),
          100
        ),
        'received',
        v_order.created_at,
        now()
      )

      on conflict (id) do update
      set
        order_json = excluded.order_json,
        total = excluded.total,
        restaurant_order_id = excluded.restaurant_order_id,
        updated_at = now()

      -- V91-18:
      -- Un conflicto UUID nunca puede modificar una fila
      -- perteneciente a otro restaurante.
      where customer_orders.user_id = v_owner_id

      returning customer_orders.id
      into v_customer_order_id;

      if v_customer_order_id is null then
        raise exception
          'Customer order does not belong to this restaurant';
      end if;

    end if;
  end if;

  perform public.rc_ordera_sync_order_station_tasks(
    v_customer_order_id
  );

  return v_customer_order_id;
end;
$function$;

COMMIT;
