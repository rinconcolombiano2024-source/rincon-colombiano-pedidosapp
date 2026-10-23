CREATE OR REPLACE FUNCTION public.save_restaurant_order_atomic_strict(p_id uuid, p_ticket_number integer, p_business_date date, p_order_json jsonb, p_total numeric, p_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_expected_revision bigint DEFAULT NULL::bigint)
 RETURNS TABLE(order_id uuid, revision bigint, server_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_existing public.orders%rowtype;
  v_next_revision bigint;
  v_server_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_id is null then
    raise exception 'Order id is required';
  end if;

  if p_ticket_number is null or p_ticket_number <= 0 then
    raise exception 'Invalid ticket number';
  end if;

  if p_business_date is null then
    raise exception 'Business date is required';
  end if;

  if p_order_json is null or jsonb_typeof(p_order_json) <> 'object' then
    raise exception 'Order JSON must be an object';
  end if;

  if p_total is null or p_total < 0 then
    raise exception 'Invalid order total';
  end if;

  select o.*
  into v_existing
  from public.orders o
  where o.id = p_id
  for update;

  if not found then
    -- Un pedido nuevo solo puede nacer sin revision previa.
    if p_expected_revision is not null then
      raise exception using
        errcode = '40001',
        message = 'ORDER_REVISION_CONFLICT: order does not exist anymore';
    end if;

    insert into public.orders as o (
      id,
      user_id,
      ticket_number,
      business_date,
      order_json,
      total,
      created_at,
      updated_at,
      revision
    ) values (
      p_id,
      v_user_id,
      p_ticket_number,
      p_business_date,
      p_order_json || jsonb_build_object('_syncRevision', 1),
      p_total,
      coalesce(p_created_at, now()),
      now(),
      1
    )
    returning o.revision, o.updated_at
    into v_next_revision, v_server_updated_at;

    return query
    select p_id, v_next_revision, v_server_updated_at;
    return;
  end if;

  if v_existing.user_id <> v_user_id then
    raise exception 'Order not found';
  end if;

  -- Las cancelaciones se hacen exclusivamente mediante void_restaurant_order().
  if coalesce(v_existing.canonical_status, '') = 'cancelled' then
    raise exception using
      errcode = '40001',
      message = 'ORDER_REVISION_CONFLICT: cancelled order cannot be overwritten';
  end if;

  -- Para actualizar un pedido existente el cliente DEBE demostrar
  -- que esta trabajando sobre la ultima revision que leyo.
  if p_expected_revision is null then
    raise exception using
      errcode = '40001',
      message = format(
        'ORDER_REVISION_REQUIRED: current revision is %s',
        v_existing.revision
      );
  end if;

  if p_expected_revision <> v_existing.revision then
    raise exception using
      errcode = '40001',
      message = format(
        'ORDER_REVISION_CONFLICT: expected %s, current %s',
        p_expected_revision,
        v_existing.revision
      );
  end if;

  v_next_revision := v_existing.revision + 1;

  update public.orders o
  set ticket_number = p_ticket_number,
      business_date = p_business_date,
      order_json = p_order_json
        || jsonb_build_object('_syncRevision', v_next_revision),
      total = p_total,
      revision = v_next_revision,
      updated_at = now()
  where o.id = p_id
    and o.user_id = v_user_id
    and o.revision = p_expected_revision
  returning o.updated_at
  into v_server_updated_at;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'ORDER_REVISION_CONFLICT: concurrent update detected';
  end if;

  return query
  select p_id, v_next_revision, v_server_updated_at;
end;
$function$;
