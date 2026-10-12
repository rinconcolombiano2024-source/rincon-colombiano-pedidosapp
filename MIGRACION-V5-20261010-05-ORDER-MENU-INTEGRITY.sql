-- Incremental RPC correction. No data rewrite. Apply V5-02 and V5-04 first.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$ DECLARE actual text; BEGIN
 SELECT md5(btrim(regexp_replace(prosrc,'\s+',' ','g'))) INTO actual FROM pg_proc
 WHERE oid=to_regprocedure('public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric)');
 IF actual IS DISTINCT FROM '5aaa82803193575067cdf83facde7069' THEN RAISE EXCEPTION 'HARDENING_RPC_BASE_MISMATCH: inspect deployed RPC'; END IF;
 IF public.rc_ordera_normalize_vat_rate('"NP"') IS DISTINCT FROM 'NP' THEN RAISE EXCEPTION 'Apply V5-04 first'; END IF;
END $$;
create or replace function public.rc_ordera_create_customer_order_edge(
  p_id uuid,
  p_user_id uuid,
  p_public_token text,
  p_table_label text,
  p_customer_name text,
  p_order_type text,
  p_order_json jsonb,
  p_customer_user_id uuid,
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
  v_menu_index jsonb := '{}'::jsonb;
  v_menu_count bigint;
  v_menu_unique bigint;
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
  -- V5-20261010-02: serializa peticiones simultáneas con el mismo id de pedido (la segunda recibe la respuesta idempotente).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_order_id::text, 9104));
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
       and v_existing.customer_user_id is not distinct from p_customer_user_id then
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

  -- One menu scan per request, rejecting duplicate product identities.
  select coalesce(jsonb_object_agg(product_id,item),'{}'::jsonb), count(*), count(distinct product_id)
  into v_menu_index,v_menu_count,v_menu_unique
  from (
    select trim(coalesce(dish.value->>'id','')) as product_id,dish.value as item
    from jsonb_each(v_menu) category
    cross join lateral jsonb_array_elements(case when jsonb_typeof(category.value)='array' then category.value else '[]'::jsonb end) dish
  ) menu_entries where product_id<>'';
  if v_menu_count<>v_menu_unique then raise exception 'Ambiguous product identity'; end if;

  for v_requested_item in select value from jsonb_array_elements(p_order_json->'items')
  loop
    v_product_id := trim(coalesce(v_requested_item->>'product_id', ''));
    if v_product_id = '' or length(v_product_id) > 200 then raise exception 'Invalid product'; end if;

    v_menu_item := v_menu_index -> v_product_id;

    if v_menu_item is null then raise exception 'Product not found'; end if;
    if jsonb_typeof(v_menu_item->'available') = 'boolean'
       and (v_menu_item->>'available')::boolean is false then
      raise exception 'Product unavailable';
    end if;

    if v_requested_item ? 'quantity' and (jsonb_typeof(v_requested_item->'quantity') <> 'number') then raise exception 'Invalid product quantity'; end if;
    if public.rc_ordera_jsonb_numeric(v_requested_item->'quantity', 1) <> trunc(public.rc_ordera_jsonb_numeric(v_requested_item->'quantity', 1)) then
      raise exception 'Invalid fractional product quantity';
    end if;
    v_quantity := floor(public.rc_ordera_jsonb_numeric(v_requested_item->'quantity', 1))::integer;
    if v_quantity < 1 or v_quantity > 50 then raise exception 'Invalid product quantity'; end if;
    v_total_quantity := v_total_quantity + v_quantity;
    if v_total_quantity > 200 then raise exception 'Order quantity limit exceeded'; end if;

    if jsonb_typeof(v_menu_item->'price') is distinct from 'number' or (v_menu_item->>'price')::numeric < 0 then raise exception 'Invalid configured product price'; end if;
    v_unit_price := round(greatest(public.rc_ordera_jsonb_numeric(v_menu_item->'price', 0), 0), 2);
    -- A shown client price is a comparison guard, never the pricing authority.
    if v_requested_item ? 'unit_price_snapshot' then
      if jsonb_typeof(v_requested_item->'unit_price_snapshot') is distinct from 'number'
        or (v_requested_item->>'unit_price_snapshot')::numeric <> v_unit_price then
        raise exception 'Menu changed before order';
      end if;
    elsif v_requested_item ? 'price' then
      if jsonb_typeof(v_requested_item->'price') is distinct from 'number'
        or (v_requested_item->>'price')::numeric <> v_unit_price then
        raise exception 'Menu changed before order';
      end if;
    end if;
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
      'vat_rate_snapshot', case when v_menu_item ? 'vatRate' and v_menu_item->'vatRate' <> 'null'::jsonb
        then public.rc_ordera_normalize_vat_rate(v_menu_item->'vatRate')
        else public.rc_ordera_normalize_vat_rate(v_settings->'defaultVatRate') end,
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
       or (v_quote.customer_user_id is not null and v_quote.customer_user_id is distinct from p_customer_user_id) then
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
    'paymentMethod', v_payment_method,
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
    p_user_id, p_customer_user_id, 'pending',
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


REVOKE ALL ON FUNCTION public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric) TO service_role;
DO $$ BEGIN
 IF has_function_privilege('anon','public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric)','EXECUTE')
 OR has_function_privilege('authenticated','public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric)','EXECUTE') THEN RAISE EXCEPTION 'Internal RPC exposed'; END IF;
END $$;
COMMIT;
-- Recovery: disable order entry; restore V5-02 RPC from checked backup if necessary.
-- Keep V5-04 helper and existing orders, secrets and quote usage unchanged.
