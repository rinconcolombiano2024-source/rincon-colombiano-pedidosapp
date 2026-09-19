-- RC ORDERA V91-12B
-- CORTE ATOMICO: HASH DE TOKENS + LIMPIEZA JSON + RPCS COMPATIBLES.
-- Ejecutar SOLO despues de desplegar marketplace-checkout que usa rc_ordera_customer_token_matches().

begin;

-- Supabase instala pgcrypto normalmente en el esquema extensions.
-- Incluimos ambos esquemas para que la migracion funcione tanto si
-- pgcrypto esta en public como si esta en extensions.
set local search_path = pg_catalog, public, extensions;

create extension if not exists pgcrypto;

do $preflight$
begin
  if to_regclass('public.customer_order_access_secrets') is null then
    raise exception 'Ejecuta primero V91-12A';
  end if;
  if has_table_privilege('authenticated', 'public.customer_orders', 'UPDATE') then
    raise exception 'V91-10 no esta aplicada: authenticated conserva UPDATE sobre customer_orders';
  end if;
end;
$preflight$;

-- V91-12B senior hardening:
-- congelar escrituras sobre customer_orders durante el corte para que ningun
-- INSERT/UPDATE concurrente pueda quedar entre el backfill y el hash.
-- SHARE ROW EXCLUSIVE permite SELECT normales, pero bloquea escrituras DML
-- hasta COMMIT. Ejecutar en una ventana corta sin creacion activa de pedidos.
lock table public.customer_orders in share row exclusive mode;
lock table public.customer_order_access_secrets in share row exclusive mode;

-- Capturar pedidos creados entre V91-12A y este corte.
insert into public.customer_order_access_secrets (
  customer_order_id, token_plaintext, created_at, updated_at
)
select co.id, co.public_token, co.created_at, now()
from public.customer_orders co
where not exists (
  select 1 from public.customer_order_access_secrets sec
  where sec.customer_order_id = co.id
)
  and length(trim(coalesce(co.public_token, ''))) between 8 and 512
on conflict (customer_order_id) do nothing;

-- No hacemos el corte si falta el secreto fuente de cualquier fila existente.
do $coverage$
begin
  if exists (
    select 1
    from public.customer_orders co
    where not exists (
      select 1 from public.customer_order_access_secrets sec
      where sec.customer_order_id = co.id
    )
  ) then
    raise exception 'TOKEN CUTOVER ABORTED: hay customer_orders sin secreto respaldado';
  end if;
end;
$coverage$;

-- Reafirmar el aislamiento de la boveda antes del corte.
alter table public.customer_order_access_secrets enable row level security;
revoke all on public.customer_order_access_secrets from public, anon, authenticated;

-- Normalizar espacios exteriores. El comparador historico ya trataba el token con trim().
update public.customer_order_access_secrets
set token_plaintext = trim(token_plaintext),
    updated_at = now()
where token_plaintext is distinct from trim(token_plaintext);

-- Eliminar cualquier copia del secreto incrustada en JSON.
update public.customer_orders
set order_json = coalesce(order_json, '{}'::jsonb) - 'publicToken' - 'public_token',
    updated_at = updated_at
where coalesce(order_json, '{}'::jsonb) ?| array['publicToken', 'public_token'];

-- Convertir la columna expuesta/replicada en un hash irreversible.
update public.customer_orders co
set public_token = encode(digest(trim(sec.token_plaintext), 'sha256'), 'hex')
from public.customer_order_access_secrets sec
where sec.customer_order_id = co.id
  and co.public_token is distinct from encode(digest(trim(sec.token_plaintext), 'sha256'), 'hex');

-- Los pedidos internos/mesero que usen el DEFAULT tampoco deben crear secretos legibles.
alter table public.customer_orders
  alter column public_token set default encode(digest(encode(gen_random_bytes(32), 'hex'), 'sha256'), 'hex');


-- Comparador central. El hash que ve el restaurante NO sirve como bearer token,
-- porque esta funcion vuelve a hashear la entrada recibida.
create or replace function public.rc_ordera_customer_token_matches(
  p_order_id uuid,
  p_public_token text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select
    p_order_id is not null
    and length(trim(coalesce(p_public_token, ''))) between 8 and 512
    and exists (
      select 1
      from public.customer_orders co
      where co.id = p_order_id
        and co.public_token = encode(digest(trim(p_public_token), 'sha256'), 'hex')
    );
$$;

revoke all on function public.rc_ordera_customer_token_matches(uuid, text)
  from public, anon, authenticated;
grant execute on function public.rc_ordera_customer_token_matches(uuid, text)
  to service_role;


-- create_customer_order: misma firma/validaciones/precios; solo cambia almacenamiento del token.
create or replace function public.create_customer_order(
  p_id uuid,
  p_user_id uuid,
  p_public_token text,
  p_table_label text,
  p_customer_name text,
  p_order_type text,
  p_order_json jsonb,
  p_total numeric
)
returns table(id uuid, public_token text)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_order_id uuid := coalesce(p_id, gen_random_uuid());
  v_existing public.customer_orders%rowtype;
  v_restaurant_country text := '';
  v_restaurant_region text := '';
  v_menu jsonb := '{}'::jsonb;
  v_settings jsonb := '{}'::jsonb;
  v_requested_item jsonb;
  v_menu_item jsonb;
  v_product_id text;
  v_quantity integer;
  v_total_quantity integer := 0;
  v_unit_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_clean_items jsonb := '[]'::jsonb;
  v_delivery jsonb;
  v_quote_id uuid;
  v_quote_token text;
  v_quote public.delivery_quotes%rowtype;
  v_fee jsonb := jsonb_build_object('base', 0, 'distance', 0, 'operational', 0, 'platform', 0, 'final', 0);
  v_final_delivery numeric := 0;
  v_final_total numeric := 0;
  v_currency text := '';
  v_payment_method text := trim(coalesce(p_order_json->>'paymentMethod', ''));
  v_payload jsonb;
begin
  if p_user_id is null then raise exception 'Restaurant is required'; end if;
  if p_public_token is null or length(trim(p_public_token)) < 8 then raise exception 'Invalid public token'; end if;
  if trim(coalesce(p_customer_name, '')) = '' then raise exception 'Customer name is required'; end if;
  if p_order_type not in ('Comer en el punto', 'Recoger en el punto', 'Domicilio') then
    raise exception 'Invalid order type';
  end if;
  if v_payment_method not in ('Efectivo', 'Transferencia', 'Datafono', 'Pago en caja', 'Pago al recoger', 'Online') then
    raise exception 'Invalid payment method';
  end if;

  select co.* into v_existing
  from public.customer_orders co
  where co.id = v_order_id;
  if found then
    if v_existing.user_id = p_user_id
       and public.rc_ordera_customer_token_matches(v_existing.id, p_public_token)
       and v_existing.customer_user_id is not distinct from auth.uid() then
      return query select v_existing.id, trim(p_public_token);
      return;
    end if;
    raise exception 'Idempotency conflict';
  end if;

  select
    upper(trim(coalesce(rp.country_code, ''))),
    lower(trim(coalesce(rp.region, ''))),
    coalesce(s.menu, '{}'::jsonb),
    coalesce(s.settings, '{}'::jsonb)
  into v_restaurant_country, v_restaurant_region, v_menu, v_settings
  from public.restaurant_profiles rp
  join public.app_settings s on s.user_id = rp.user_id
  where rp.user_id = p_user_id
    and rp.active = true
    and rp.deleted_at is null
    and case
      when rp.operational_mode = 'schedule' then public.restaurant_schedule_is_open(
        rp.opening_hours,
        coalesce(nullif(trim(rp.timezone), ''), case upper(trim(rp.country_code))
          when 'PL' then 'Europe/Warsaw' when 'CO' then 'America/Bogota' else 'UTC' end),
        now()
      )
      else rp.operational_open
    end = true
  for share of rp, s;
  if not found then raise exception 'Restaurant is closed'; end if;

  if v_payment_method = 'Online'
     and lower(trim(coalesce(v_settings->>'onlinePaymentProvider', 'disabled'))) <> 'stripe' then
    raise exception 'Online payment is unavailable';
  end if;

  if jsonb_typeof(coalesce(p_order_json->'items', 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_order_json->'items') = 0
     or jsonb_array_length(p_order_json->'items') > 60 then
    raise exception 'Invalid product list';
  end if;

  for v_requested_item in select value from jsonb_array_elements(p_order_json->'items')
  loop
    v_product_id := trim(coalesce(v_requested_item->>'product_id', ''));
    if v_product_id = '' or length(v_product_id) > 200 then raise exception 'Invalid product'; end if;

    select dish.value into v_menu_item
    from jsonb_each(v_menu) category
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(category.value) = 'array' then category.value else '[]'::jsonb end
    ) dish
    where trim(coalesce(dish.value->>'id', '')) = v_product_id
    limit 1;

    if v_menu_item is null then raise exception 'Product not found'; end if;
    if jsonb_typeof(v_menu_item->'available') = 'boolean'
       and (v_menu_item->>'available')::boolean is false then
      raise exception 'Product unavailable';
    end if;

    v_quantity := floor(public.rc_ordera_jsonb_numeric(v_requested_item->'quantity', 1))::integer;
    if v_quantity < 1 or v_quantity > 50 then raise exception 'Invalid product quantity'; end if;
    v_total_quantity := v_total_quantity + v_quantity;
    if v_total_quantity > 200 then raise exception 'Order quantity limit exceeded'; end if;

    v_unit_price := round(greatest(public.rc_ordera_jsonb_numeric(v_menu_item->'price', 0), 0), 2);
    v_line_total := round(v_unit_price * v_quantity, 2);
    v_subtotal := v_subtotal + v_line_total;

    v_clean_items := v_clean_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'product_name_snapshot', left(trim(coalesce(v_menu_item->>'name', 'Producto')), 200),
      'unit_price_snapshot', v_unit_price,
      'quantity', v_quantity,
      'options_snapshot', jsonb_build_object(
        'description', left(coalesce(v_menu_item->>'description', ''), 1000),
        'note', upper(left(coalesce(v_requested_item #>> '{options_snapshot,note}', v_requested_item->>'note', ''), 1000)),
        'station', left(trim(coalesce(v_menu_item->>'station', 'Cocina')), 80)
      ),
      'total_snapshot', v_line_total,
      'name', left(trim(coalesce(v_menu_item->>'name', 'Producto')), 200),
      'description', left(coalesce(v_menu_item->>'description', ''), 1000),
      'price', v_unit_price,
      'qty', v_quantity,
      'note', upper(left(coalesce(v_requested_item->>'note', ''), 1000)),
      'station', left(trim(coalesce(v_menu_item->>'station', 'Cocina')), 80)
    ));
    v_menu_item := null;
  end loop;

  v_subtotal := round(v_subtotal, 2);
  if v_subtotal <= 0 or v_subtotal > 100000000 then raise exception 'Invalid order total'; end if;

  v_delivery := coalesce(p_order_json->'delivery', 'null'::jsonb);
  if p_order_type = 'Domicilio' then
    if jsonb_typeof(v_delivery) <> 'object' then raise exception 'Delivery information is required'; end if;
    if length(trim(coalesce(v_delivery->>'phone', ''))) < 5 then raise exception 'Delivery phone is required'; end if;
    if length(trim(coalesce(v_delivery->>'address', ''))) < 5 then raise exception 'Delivery address is required'; end if;
    if v_restaurant_country = '' then raise exception 'Restaurant country is not configured'; end if;
    if upper(trim(coalesce(v_delivery->>'countryCode', ''))) <> v_restaurant_country then
      raise exception 'Restaurant country does not match delivery country';
    end if;
    begin
      v_quote_id := (v_delivery->>'quoteId')::uuid;
    exception when others then
      raise exception 'Valid delivery quote is required';
    end;
    v_quote_token := trim(coalesce(v_delivery->>'quoteToken', ''));
    if length(v_quote_token) < 32 then raise exception 'Valid delivery quote is required'; end if;

    select dq.* into v_quote
    from public.delivery_quotes dq
    where dq.id = v_quote_id
    for update;
    if not found
       or v_quote.restaurant_user_id <> p_user_id
       or v_quote.token_hash <> encode(digest(v_quote_token, 'sha256'), 'hex')
       or v_quote.used_at is not null
       or v_quote.expires_at <= now()
       or (v_quote.customer_user_id is not null and v_quote.customer_user_id is distinct from auth.uid()) then
      raise exception 'Delivery quote is invalid or expired';
    end if;

    v_fee := v_quote.fee_breakdown;
    v_final_delivery := v_quote.final_fee;
    v_currency := v_quote.currency;
    v_delivery := v_delivery || jsonb_build_object(
      'distanceKm', v_quote.distance_km,
      'durationSeconds', v_quote.duration_seconds,
      'serverValidated', true,
      'quoteId', v_quote.id,
      'quoteExpiresAt', v_quote.expires_at,
      'fee', v_final_delivery,
      'feeBreakdown', v_fee
    ) - 'quoteToken';
  else
    v_delivery := 'null'::jsonb;
  end if;

  if v_currency = '' then
    v_currency := case
      when v_restaurant_country = 'PL' then 'PLN'
      when v_restaurant_country = 'CO' then 'COP'
      else upper(left(coalesce(v_settings->>'currencyCode', ''), 3))
    end;
  end if;
  if v_currency = '' then raise exception 'Restaurant currency is not configured'; end if;

  v_final_total := round(v_subtotal + v_final_delivery, 2);
  v_payload := (coalesce(p_order_json, '{}'::jsonb) - 'publicToken' - 'public_token') || jsonb_build_object(
    'items', v_clean_items,
    'delivery', v_delivery,
    'subtotal', v_subtotal,
    'total', v_final_total,
    'currency', v_currency,
    'pricingSource', 'server-v86'
  );

  insert into public.customer_orders (
    id, idempotency_key, public_token, user_id, customer_user_id, status, table_label,
    customer_name, order_type, order_json, total, currency, subtotal,
    base_delivery_fee, distance_fee, operational_adjustment, platform_adjustment,
    final_delivery_fee, payment_method, payment_status, payment_amount, payment_currency,
    created_at, updated_at
  ) values (
    v_order_id, v_order_id::text, encode(digest(trim(p_public_token), 'sha256'), 'hex'),
    p_user_id, auth.uid(), 'pending',
    left(trim(coalesce(p_table_label, '')), 160), left(trim(p_customer_name), 160),
    p_order_type, v_payload, v_final_total, v_currency, v_subtotal,
    public.rc_ordera_jsonb_numeric(v_fee->'base', 0),
    public.rc_ordera_jsonb_numeric(v_fee->'distance', 0),
    public.rc_ordera_jsonb_numeric(v_fee->'operational', 0),
    public.rc_ordera_jsonb_numeric(v_fee->'platform', 0),
    v_final_delivery,
    v_payment_method, 'pending', v_final_total, v_currency,
    now(), now()
  );

  insert into public.customer_order_access_secrets (
    customer_order_id, token_plaintext, created_at, updated_at
  ) values (
    v_order_id, trim(p_public_token), now(), now()
  )
  on conflict (customer_order_id) do update set
    token_plaintext = excluded.token_plaintext,
    updated_at = now();

  if p_order_type = 'Domicilio' then
    update public.delivery_quotes
    set used_at = now(), used_by_order_id = v_order_id
    where id = v_quote_id;
  end if;

  return query select v_order_id, trim(p_public_token);
end;
$$;

revoke all on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) from public;
grant execute on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) to anon, authenticated;


-- get_customer_order_status: misma firma; token validado por hash.
create or replace function public.get_customer_order_status(
  p_order_id uuid,
  p_public_token text
)
returns table(status text, updated_at timestamptz, restaurant_order_id uuid, ticket_number integer)
language sql
security definer
set search_path = public
as $$
  select co.status, co.updated_at, co.restaurant_order_id, o.ticket_number
  from public.customer_orders co
  left join public.orders o on o.id = co.restaurant_order_id
  where co.id = p_order_id
    and public.rc_ordera_customer_token_matches(co.id, p_public_token)
  limit 1;
$$;


-- create_customer_message: misma firma; token validado por hash.
create or replace function public.create_customer_message(
  p_order_id uuid,
  p_public_token text,
  p_body text,
  p_image_data_url text
)
returns table(id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_body text := left(trim(coalesce(p_body, '')), 1200);
  v_image text := coalesce(p_image_data_url, '');
begin
  select co.user_id
    into v_user_id
  from public.customer_orders co
  where co.id = p_order_id
    and public.rc_ordera_customer_token_matches(co.id, p_public_token);

  if v_user_id is null then
    raise exception 'Order not found';
  end if;

  if v_image <> '' and v_image not like 'data:image/%' then
    raise exception 'Invalid image';
  end if;

  if length(v_image) > 950000 then
    raise exception 'Image too large';
  end if;

  if v_body = '' and v_image = '' then
    raise exception 'Empty message';
  end if;

  return query
  insert into public.customer_order_messages (order_id, user_id, sender, body, image_data_url)
  values (p_order_id, v_user_id, 'customer', v_body, v_image)
  returning public.customer_order_messages.id;
end;
$$;


-- get_customer_order_messages: misma firma; token validado por hash.
create or replace function public.get_customer_order_messages(
  p_order_id uuid,
  p_public_token text
)
returns table(id uuid, sender text, body text, image_data_url text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select msg.id, msg.sender, msg.body, msg.image_data_url, msg.created_at
  from public.customer_order_messages msg
  join public.customer_orders co on co.id = msg.order_id
  where co.id = p_order_id
    and public.rc_ordera_customer_token_matches(co.id, p_public_token)
  order by msg.created_at asc;
$$;


-- get_customer_order_timeline: misma firma; token validado por hash.
create or replace function public.get_customer_order_timeline(
  p_order_id uuid,
  p_public_token text
)
returns table(
  id uuid,
  previous_status text,
  new_status text,
  actor_role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if p_order_id is null or trim(coalesce(p_public_token, '')) = '' then
    return;
  end if;
  if not exists (
    select 1
    from public.customer_orders co
    where co.id = p_order_id
      and public.rc_ordera_customer_token_matches(co.id, p_public_token)
      and (co.customer_user_id is null or auth.uid() is null or co.customer_user_id = auth.uid())
  ) then
    return;
  end if;

  return query
  select osh.id, osh.previous_status, osh.new_status, osh.actor_role, osh.created_at
  from public.order_status_history osh
  where osh.customer_order_id = p_order_id
  order by osh.created_at asc, osh.id asc;
end;
$$;


-- get_customer_order_tracking: misma firma; token validado por hash.
create or replace function public.get_customer_order_tracking(
  p_order_id uuid,
  p_public_token text
)
returns table(
  customer_order_id uuid,
  status text,
  canonical_status text,
  updated_at timestamptz,
  restaurant_order_id uuid,
  ticket_number integer,
  courier_assignment_status text,
  assignment_id uuid,
  courier_user_id uuid,
  courier_name text,
  courier_lat numeric,
  courier_lng numeric,
  courier_location_updated_at timestamptz,
  estimated_pickup_at timestamptz,
  estimated_delivery_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if p_order_id is null or trim(coalesce(p_public_token, '')) = '' then
    return;
  end if;

  return query
  select
    co.id,
    co.status,
    co.canonical_status,
    co.updated_at,
    co.restaurant_order_id,
    o.ticket_number,
    coalesce(da.status, co.courier_assignment_status),
    da.id,
    da.courier_user_id,
    nullif(trim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, '')), ''),
    case
      when da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
        and co.canonical_status not in ('delivered', 'cancelled', 'rejected', 'failed', 'refunded')
      then cl.lat
      else null
    end,
    case
      when da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
        and co.canonical_status not in ('delivered', 'cancelled', 'rejected', 'failed', 'refunded')
      then cl.lng
      else null
    end,
    case
      when da.status in ('accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer')
        and co.canonical_status not in ('delivered', 'cancelled', 'rejected', 'failed', 'refunded')
      then coalesce(cl.last_location_at, cl.updated_at)
      else null
    end,
    coalesce(da.estimated_pickup_at, co.estimated_pickup_at),
    coalesce(da.estimated_delivery_at, co.estimated_delivery_at)
  from public.customer_orders co
  left join public.orders o
    on o.id = co.restaurant_order_id
  left join lateral (
    select candidate.*
    from public.delivery_assignments candidate
    where candidate.customer_order_id = co.id
    order by
      case when candidate.status in ('offered', 'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer') then 0 else 1 end,
      candidate.updated_at desc,
      candidate.id desc
    limit 1
  ) da on true
  left join public.courier_profiles cp
    on cp.user_id = da.courier_user_id
  left join public.courier_live_locations cl
    on cl.user_id = da.courier_user_id
  where co.id = p_order_id
    and public.rc_ordera_customer_token_matches(co.id, p_public_token)
    and (
      co.customer_user_id is null
      or auth.uid() is null
      or co.customer_user_id = auth.uid()
    )
  limit 1;
end;
$$;


-- record_delivery_completion_confirmation: misma firma; token validado por hash.
create or replace function public.record_delivery_completion_confirmation(
  p_customer_order_id uuid,
  p_public_token text,
  p_actor text
)
returns table (
  courier_confirmed boolean,
  customer_confirmed boolean,
  settlement_eligible boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor text := lower(trim(coalesce(p_actor, '')));
  v_order public.customer_orders%rowtype;
  v_assignment public.delivery_assignments%rowtype;
  v_confirmation public.delivery_completion_confirmations%rowtype;
begin
  select co.* into v_order from public.customer_orders co where co.id = p_customer_order_id;
  if not found then raise exception 'Order was not found'; end if;
  select da.* into v_assignment from public.delivery_assignments da
  where da.customer_order_id = v_order.id and da.status = 'delivered'
  order by da.delivered_at desc nulls last, da.updated_at desc limit 1;
  if not found then raise exception 'Delivery is not completed'; end if;

  if v_actor = 'courier' then
    if auth.uid() is null or auth.uid() <> v_assignment.courier_user_id then raise exception 'Not authorized'; end if;
  elsif v_actor = 'customer' then
    if not (
      (auth.uid() is not null and auth.uid() = v_order.customer_user_id)
      or public.rc_ordera_customer_token_matches(v_order.id, p_public_token)
    ) then raise exception 'Not authorized'; end if;
  else raise exception 'Invalid confirmation actor'; end if;

  insert into public.delivery_completion_confirmations (
    customer_order_id, delivery_assignment_id, customer_user_id, courier_user_id,
    courier_confirmed_at, customer_confirmed_at, updated_at
  ) values (
    v_order.id, v_assignment.id, v_order.customer_user_id, v_assignment.courier_user_id,
    case when v_actor = 'courier' then now() else null end,
    case when v_actor = 'customer' then now() else null end, now()
  )
  on conflict (customer_order_id) do update set
    courier_confirmed_at = case when v_actor = 'courier' then coalesce(delivery_completion_confirmations.courier_confirmed_at, now()) else delivery_completion_confirmations.courier_confirmed_at end,
    customer_confirmed_at = case when v_actor = 'customer' then coalesce(delivery_completion_confirmations.customer_confirmed_at, now()) else delivery_completion_confirmations.customer_confirmed_at end,
    completed_at = case when
      coalesce(delivery_completion_confirmations.courier_confirmed_at, case when v_actor = 'courier' then now() end) is not null
      and coalesce(delivery_completion_confirmations.customer_confirmed_at, case when v_actor = 'customer' then now() end) is not null
      then coalesce(delivery_completion_confirmations.completed_at, now()) else delivery_completion_confirmations.completed_at end,
    updated_at = now()
  returning * into v_confirmation;

  if v_confirmation.courier_confirmed_at is not null and v_confirmation.customer_confirmed_at is not null then
    update public.marketplace_payment_allocations a
    set courier_user_id = v_assignment.courier_user_id,
        courier_release_eligible_at = coalesce(a.courier_release_eligible_at, now()),
        status = case when a.restaurant_release_eligible_at is not null then 'eligible' else a.status end,
        updated_at = now()
    where a.customer_order_id = v_order.id;
  end if;

  return query select
    v_confirmation.courier_confirmed_at is not null,
    v_confirmation.customer_confirmed_at is not null,
    v_confirmation.courier_confirmed_at is not null and v_confirmation.customer_confirmed_at is not null;
end;
$$;


-- get_order_marketplace_payment_state: misma firma; token validado por hash.
create or replace function public.get_order_marketplace_payment_state(
  p_customer_order_id uuid,
  p_public_token text
)
returns table (
  payment_status text,
  provider text,
  amount numeric,
  currency text,
  courier_confirmed boolean,
  customer_confirmed boolean,
  allocation_status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if not exists (
    select 1 from public.customer_orders co
    where co.id = p_customer_order_id and (
      co.user_id = auth.uid() or co.customer_user_id = auth.uid()
      or public.rc_ordera_customer_token_matches(co.id, p_public_token)
      or public.rc_ordera_is_platform_admin(auth.uid())
    )
  ) then raise exception 'Not authorized'; end if;
  return query
  select coalesce(pt.status, 'not_started'), coalesce(pt.provider, ''),
    coalesce(pt.amount, 0), coalesce(pt.currency, ''),
    dc.courier_confirmed_at is not null, dc.customer_confirmed_at is not null,
    coalesce(a.status, 'not_allocated')
  from public.customer_orders co
  left join lateral (
    select p.* from public.payment_transactions p where p.customer_order_id = co.id
    order by p.created_at desc limit 1
  ) pt on true
  left join public.delivery_completion_confirmations dc on dc.customer_order_id = co.id
  left join public.marketplace_payment_allocations a on a.customer_order_id = co.id
  where co.id = p_customer_order_id;
end;
$$;


-- Historial: solo el cliente autenticado recupera su secreto desde la boveda.
create or replace function public.get_customer_order_history()
returns table(
  id uuid,
  public_token text,
  restaurant_user_id uuid,
  restaurant_name text,
  status text,
  table_label text,
  customer_name text,
  order_type text,
  order_json jsonb,
  total numeric,
  restaurant_order_id uuid,
  ticket_number integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    co.id,
    sec.token_plaintext as public_token,
    co.user_id as restaurant_user_id,
    coalesce(nullif(rp.business_name, ''), nullif(s.settings->>'businessName', ''), 'Restaurante') as restaurant_name,
    co.status,
    co.table_label,
    co.customer_name,
    co.order_type,
    coalesce(co.order_json, '{}'::jsonb) - 'publicToken' - 'public_token' as order_json,
    co.total,
    co.restaurant_order_id,
    o.ticket_number,
    co.created_at,
    co.updated_at
  from public.customer_orders co
  left join public.orders o on o.id = co.restaurant_order_id
  left join public.customer_order_access_secrets sec on sec.customer_order_id = co.id
  left join public.app_settings s on s.user_id = co.user_id
  left join public.restaurant_profiles rp on rp.user_id = co.user_id
  where co.customer_user_id = auth.uid()
  order by co.created_at desc
  limit 100;
$$;


-- Restablecer permisos de RPC exactamente a los actores que ya las usaban.
grant execute on function public.get_customer_order_status(uuid, text) to anon, authenticated;
grant execute on function public.get_customer_order_history() to authenticated;
grant execute on function public.create_customer_message(uuid, text, text, text) to anon, authenticated;
grant execute on function public.get_customer_order_messages(uuid, text) to anon, authenticated;
grant execute on function public.get_customer_order_timeline(uuid, text) to anon, authenticated;
grant execute on function public.get_customer_order_tracking(uuid, text) to anon, authenticated;
grant execute on function public.record_delivery_completion_confirmation(uuid, text, text) to anon, authenticated;
grant execute on function public.get_order_marketplace_payment_state(uuid, text) to anon, authenticated;

-- Postchecks.
do $postcheck$
declare
  v_bad bigint;
begin
  select count(*) into v_bad
  from public.customer_orders co
  where co.public_token !~ '^[0-9a-f]{64}$';
  if v_bad <> 0 then
    raise exception 'SECURITY ERROR: % customer_orders conservan public_token sin hash SHA-256', v_bad;
  end if;

  select count(*) into v_bad
  from public.customer_orders co
  where coalesce(co.order_json, '{}'::jsonb) ?| array['publicToken', 'public_token'];
  if v_bad <> 0 then
    raise exception 'SECURITY ERROR: % customer_orders conservan token dentro de order_json', v_bad;
  end if;

  select count(*) into v_bad
  from public.customer_order_access_secrets sec
  join public.customer_orders co on co.id = sec.customer_order_id
  where co.public_token <> encode(digest(trim(sec.token_plaintext), 'sha256'), 'hex');
  if v_bad <> 0 then
    raise exception 'SECURITY ERROR: % secretos no coinciden con su hash', v_bad;
  end if;

  -- Cada secreto real debe seguir autenticando despues del corte.
  select count(*) into v_bad
  from public.customer_order_access_secrets sec
  where not public.rc_ordera_customer_token_matches(sec.customer_order_id, sec.token_plaintext);
  if v_bad <> 0 then
    raise exception 'SECURITY ERROR: % secretos reales dejaron de autenticar', v_bad;
  end if;

  -- El hash que queda visible en customer_orders nunca debe funcionar como bearer token.
  select count(*) into v_bad
  from public.customer_orders co
  where public.rc_ordera_customer_token_matches(co.id, co.public_token);
  if v_bad <> 0 then
    raise exception 'SECURITY ERROR: % hashes visibles autentican como token', v_bad;
  end if;

  if has_table_privilege('authenticated', 'public.customer_order_access_secrets', 'SELECT')
     or has_table_privilege('authenticated', 'public.customer_order_access_secrets', 'INSERT')
     or has_table_privilege('authenticated', 'public.customer_order_access_secrets', 'UPDATE')
     or has_table_privilege('authenticated', 'public.customer_order_access_secrets', 'DELETE')
     or has_table_privilege('anon', 'public.customer_order_access_secrets', 'SELECT')
     or has_table_privilege('anon', 'public.customer_order_access_secrets', 'INSERT')
     or has_table_privilege('anon', 'public.customer_order_access_secrets', 'UPDATE')
     or has_table_privilege('anon', 'public.customer_order_access_secrets', 'DELETE') then
    raise exception 'SECURITY ERROR: anon/authenticated conservan privilegios sobre la boveda';
  end if;

  if has_function_privilege('authenticated', 'public.rc_ordera_customer_token_matches(uuid,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rc_ordera_customer_token_matches(uuid,text)', 'EXECUTE') then
    raise exception 'SECURITY ERROR: el comparador interno de tokens es invocable directamente';
  end if;

  if not has_function_privilege('service_role', 'public.rc_ordera_customer_token_matches(uuid,text)', 'EXECUTE') then
    raise exception 'SECURITY ERROR: service_role no puede validar tokens';
  end if;
end;
$postcheck$;

commit;
notify pgrst, 'reload schema';
