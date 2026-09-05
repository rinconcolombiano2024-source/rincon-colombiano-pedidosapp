-- RC ORDERA V91.06
-- Corrige sincronizacion de estaciones.
-- PostgreSQL no dispone de jsonb_object_length(jsonb).
-- No elimina ni modifica pedidos historicos.

begin;

create or replace function public.rc_ordera_sync_order_station_tasks(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.customer_orders%rowtype;
  v_item jsonb;
  v_station text;
  v_groups jsonb := '{}'::jsonb;
  v_group record;
begin

  select co.*
  into v_order
  from public.customer_orders co
  where co.id = p_order_id;

  if not found then
    return;
  end if;


  -- Si el pedido fue cancelado/rechazado,
  -- cancelar tambien las tareas de estaciones.
  if v_order.status in ('cancelled', 'rejected') then

    update public.order_station_tasks
    set
      status = 'cancelled',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
    where customer_order_id = v_order.id
      and status <> 'cancelled';

    return;

  end if;


  -- Agrupar productos por estacion.
  for v_item in
    select value
    from jsonb_array_elements(
      coalesce(
        v_order.order_json->'items',
        '[]'::jsonb
      )
    )
  loop

    v_station :=
      public.rc_ordera_order_item_station(
        v_order.user_id,
        v_item
      );

    v_groups :=
      jsonb_set(
        v_groups,
        array[v_station],
        coalesce(
          v_groups->v_station,
          '[]'::jsonb
        )
        ||
        jsonb_build_array(
          v_item ||
          jsonb_build_object(
            'station',
            v_station
          )
        ),
        true
      );

  end loop;


  -- Crear/actualizar tareas de cada estacion.
  for v_group in
    select key, value
    from jsonb_each(v_groups)
  loop

    insert into public.order_station_tasks (
      customer_order_id,
      restaurant_user_id,
      station,
      status,
      items,
      updated_at
    )
    values (
      v_order.id,
      v_order.user_id,
      v_group.key,

      case
        when v_order.station_status in (
          'ready',
          'packed',
          'dispatched',
          'completed'
        )
        then 'ready'
        else 'received'
      end,

      v_group.value,
      now()
    )

    on conflict (
      customer_order_id,
      station
    )
    do update
    set
      items = excluded.items,
      updated_at = now();

  end loop;


  -- ==========================================================
  -- CORRECCION V91.06
  --
  -- Antes:
  -- jsonb_object_length(v_groups) > 0
  --
  -- Esa funcion no existe en PostgreSQL.
  --
  -- v_groups siempre comienza como {} y solamente recibe
  -- propiedades mediante jsonb_set, por lo que esta comparacion
  -- es suficiente y mas eficiente.
  -- ==========================================================

  if v_groups <> '{}'::jsonb then

    insert into public.order_station_tasks (
      customer_order_id,
      restaurant_user_id,
      station,
      status,
      items,
      updated_at
    )
    values (
      v_order.id,
      v_order.user_id,
      'packing',

      case
        when v_order.station_status in (
          'ready',
          'packed',
          'dispatched',
          'completed'
        )
        then 'received'
        else 'blocked'
      end,

      coalesce(
        v_order.order_json->'items',
        '[]'::jsonb
      ),

      now()
    )

    on conflict (
      customer_order_id,
      station
    )
    do update
    set
      items = excluded.items,
      updated_at = now();

  end if;

end;
$$;

commit;
