-- STAGING ONLY: production variants exported by owner on 2026-10-11.

-- Does not add VAT, fiscal result RPC, translation v2 or delivery outbox.

BEGIN;

SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '30s';

DO $guard$ BEGIN IF (SELECT md5(btrim(regexp_replace(prosrc,'\s+',' ','g'))) FROM pg_proc WHERE oid=to_regprocedure('public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric)')) IS DISTINCT FROM 'ef9d52a979ac031a5567dc332208e1db' THEN RAISE EXCEPTION 'DEPLOYED_RPC_MISMATCH: public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric)'; END IF; END $guard$;

CREATE OR REPLACE FUNCTION public.rc_ordera_create_customer_order_edge(p_id uuid, p_user_id uuid, p_public_token text, p_table_label text, p_customer_name text, p_order_type text, p_order_json jsonb, p_customer_user_id uuid, p_total numeric)
 RETURNS TABLE(id uuid, public_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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
  -- Shared by both order entry points; held until transaction completion.
  perform pg_advisory_xact_lock(hashtextextended('rc_ordera_order:' || v_order_id::text, 0));


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
    where delivery_quotes.id = v_quote_id;
  end if;

  return query select v_order_id, trim(p_public_token);
end;
$function$;

DO $guard$ BEGIN IF (SELECT md5(btrim(regexp_replace(prosrc,'\s+',' ','g'))) FROM pg_proc WHERE oid=to_regprocedure('public.rc_ordera_create_customer_order_edge(uuid,uuid,text,text,text,text,jsonb,uuid,numeric)')) IS DISTINCT FROM 'f5b045debae4f302d1c7f749b3a1ea85' THEN RAISE EXCEPTION 'POSTCHECK_FAILED'; END IF; END $guard$;

DO $guard$ BEGIN IF (SELECT md5(btrim(regexp_replace(prosrc,'\s+',' ','g'))) FROM pg_proc WHERE oid=to_regprocedure('public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)')) IS DISTINCT FROM '6b564f96969435b32b7dd62d025ae220' THEN RAISE EXCEPTION 'DEPLOYED_RPC_MISMATCH: public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)'; END IF; END $guard$;

CREATE OR REPLACE FUNCTION public.create_customer_order_v91_22_core(p_id uuid, p_user_id uuid, p_public_token text, p_table_label text, p_customer_name text, p_order_type text, p_order_json jsonb, p_total numeric)
 RETURNS TABLE(id uuid, public_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_order_id uuid := coalesce(p_id, gen_random_uuid());
  v_existing public.customer_orders%rowtype;
  v_restaurant_country text := '';
  v_restaurant_region text := '';
  v_menu jsonb := '{}'::jsonb;
  v_settings jsonb := '{}'::jsonb;

  v_requested_item jsonb;
  v_menu_item jsonb;

  -- V91-22
  v_menu_lookup_v22 jsonb := '{}'::jsonb;
  v_requested_ids_v22 text[];

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

  v_fee jsonb := jsonb_build_object(
    'base', 0,
    'distance', 0,
    'operational', 0,
    'platform', 0,
    'final', 0
  );

  v_final_delivery numeric := 0;
  v_final_total numeric := 0;
  v_currency text := '';

  v_payment_method text :=
    trim(coalesce(p_order_json->>'paymentMethod', ''));

  v_payload jsonb;

begin

  --------------------------------------------------------------
  -- CONTRATO ORIGINAL
  --------------------------------------------------------------

  if p_user_id is null then
    raise exception 'Restaurant is required';
  end if;

  if p_public_token is null
     or length(trim(p_public_token)) < 8 then
    raise exception 'Invalid public token';
  end if;

  if trim(coalesce(p_customer_name, '')) = '' then
    raise exception 'Customer name is required';
  end if;

  if p_order_type not in (
    'Comer en el punto',
    'Recoger en el punto',
    'Domicilio'
  ) then
    raise exception 'Invalid order type';
  end if;

  if v_payment_method not in (
    'Efectivo',
    'Transferencia',
    'Datafono',
    'Pago en caja',
    'Pago al recoger',
    'Online'
  ) then
    raise exception 'Invalid payment method';
  end if;


  --------------------------------------------------------------
  -- IDEMPOTENCIA ORIGINAL
  --------------------------------------------------------------
  -- Shared by both order entry points; held until transaction completion.
  perform pg_advisory_xact_lock(hashtextextended('rc_ordera_order:' || v_order_id::text, 0));


  select co.*
  into v_existing
  from public.customer_orders co
  where co.id = v_order_id;

  if found then

    if v_existing.user_id = p_user_id
       and public.rc_ordera_customer_token_matches(
         v_existing.id,
         p_public_token
       )
       and v_existing.customer_user_id
           is not distinct from auth.uid()
    then

      return query
      select
        v_existing.id,
        trim(p_public_token);

      return;

    end if;

    raise exception 'Idempotency conflict';

  end if;


  --------------------------------------------------------------
  -- RESTAURANTE / MENU / CONFIGURACION
  --------------------------------------------------------------

  select
    upper(trim(coalesce(rp.country_code, ''))),
    lower(trim(coalesce(rp.region, ''))),
    coalesce(s.menu, '{}'::jsonb),
    coalesce(s.settings, '{}'::jsonb)

  into
    v_restaurant_country,
    v_restaurant_region,
    v_menu,
    v_settings

  from public.restaurant_profiles rp
  join public.app_settings s
    on s.user_id = rp.user_id

  where rp.user_id = p_user_id
    and rp.active = true
    and rp.deleted_at is null
    and case

      when rp.operational_mode = 'schedule'
      then public.restaurant_schedule_is_open(
        rp.opening_hours,
        coalesce(
          nullif(trim(rp.timezone), ''),
          case upper(trim(rp.country_code))
            when 'PL' then 'Europe/Warsaw'
            when 'CO' then 'America/Bogota'
            else 'UTC'
          end
        ),
        now()
      )

      else rp.operational_open

    end = true

  for share of rp, s;


  if not found then
    raise exception 'Restaurant is closed';
  end if;


  --------------------------------------------------------------
  -- CONTRATO ORIGINAL
  --------------------------------------------------------------

  if v_payment_method = 'Online'
     and lower(
       trim(
         coalesce(
           v_settings->>'onlinePaymentProvider',
           'disabled'
         )
       )
     ) <> 'stripe'
  then
    raise exception 'Online payment is unavailable';
  end if;


  --------------------------------------------------------------
  -- VALIDACION LISTA DE PRODUCTOS
  --------------------------------------------------------------

  if jsonb_typeof(
       coalesce(
         p_order_json->'items',
         'null'::jsonb
       )
     ) <> 'array'

     or jsonb_array_length(
       p_order_json->'items'
     ) = 0

     or jsonb_array_length(
       p_order_json->'items'
     ) > 60

  then
    raise exception 'Invalid product list';
  end if;


  --------------------------------------------------------------
  -- V91-22
  -- VALIDAR IDS ANTES DE RECORRER EL MENU
  --------------------------------------------------------------

  if exists (

    select 1

    from jsonb_array_elements(
      p_order_json->'items'
    ) as requested(value)

    where
      trim(
        coalesce(
          requested.value->>'product_id',
          ''
        )
      ) = ''

      or

      length(
        trim(
          coalesce(
            requested.value->>'product_id',
            ''
          )
        )
      ) > 200

  ) then

    raise exception 'Invalid product';

  end if;


  --------------------------------------------------------------
  -- V91-22
  -- EXTRAER SOLO IDS SOLICITADOS
  --------------------------------------------------------------

  select array_agg(
    distinct trim(
      coalesce(
        requested.value->>'product_id',
        ''
      )
    )
  )

  into v_requested_ids_v22

  from jsonb_array_elements(
    p_order_json->'items'
  ) as requested(value);


  --------------------------------------------------------------
  -- V91-22
  -- CONSTRUIR LOOKUP DEL MENU UNA SOLA VEZ
  --
  -- El DISTINCT ON conserva un unico producto por ID.
  -- category_ord / dish_ord permiten resolver duplicados
  -- de manera determinista.
  --------------------------------------------------------------

  select coalesce(
    jsonb_object_agg(
      menu_rows.product_id,
      menu_rows.menu_item
    ),
    '{}'::jsonb
  )

  into v_menu_lookup_v22

  from (

    select distinct on (
      trim(
        coalesce(
          dish.value->>'id',
          ''
        )
      )
    )

      trim(
        coalesce(
          dish.value->>'id',
          ''
        )
      ) as product_id,

      dish.value as menu_item

    from jsonb_each(v_menu)
      with ordinality
      as category(
        category_key,
        category_value,
        category_ord
      )

    cross join lateral jsonb_array_elements(

      case
        when jsonb_typeof(
          category.category_value
        ) = 'array'
        then category.category_value
        else '[]'::jsonb
      end

    )
      with ordinality
      as dish(
        value,
        dish_ord
      )

    where
      trim(
        coalesce(
          dish.value->>'id',
          ''
        )
      ) = any(v_requested_ids_v22)

      and trim(
        coalesce(
          dish.value->>'id',
          ''
        )
      ) <> ''

    order by

      trim(
        coalesce(
          dish.value->>'id',
          ''
        )
      ),

      category.category_ord,
      dish.dish_ord

  ) menu_rows;


  --------------------------------------------------------------
  -- PROCESAMIENTO DE PRODUCTOS
  --------------------------------------------------------------

  for v_requested_item
  in

    select value
    from jsonb_array_elements(
      p_order_json->'items'
    )

  loop

    v_product_id :=
      trim(
        coalesce(
          v_requested_item->>'product_id',
          ''
        )
      );


    ------------------------------------------------------------
    -- Se conserva tambien la validacion original.
    ------------------------------------------------------------

    if v_product_id = ''
       or length(v_product_id) > 200
    then

      raise exception 'Invalid product';

    end if;


    ------------------------------------------------------------
    -- V91-22
    -- O(1) SOBRE EL LOOKUP EN LUGAR DE RECORRER MENU COMPLETO
    ------------------------------------------------------------

    v_menu_item :=
      v_menu_lookup_v22 -> v_product_id;


    if v_menu_item is null then
      raise exception 'Product not found';
    end if;


    if jsonb_typeof(
         v_menu_item->'available'
       ) = 'boolean'

       and (
         v_menu_item->>'available'
       )::boolean is false

    then
      raise exception 'Product unavailable';
    end if;


    ------------------------------------------------------------
    -- CANTIDADES
    ------------------------------------------------------------

    v_quantity :=
      floor(
        public.rc_ordera_jsonb_numeric(
          v_requested_item->'quantity',
          1
        )
      )::integer;


    if v_quantity < 1
       or v_quantity > 50
    then
      raise exception 'Invalid product quantity';
    end if;


    v_total_quantity :=
      v_total_quantity + v_quantity;


    if v_total_quantity > 200 then
      raise exception 'Order quantity limit exceeded';
    end if;


    ------------------------------------------------------------
    -- PRECIO DESDE SERVIDOR
    ------------------------------------------------------------

    v_unit_price :=
      round(
        greatest(
          public.rc_ordera_jsonb_numeric(
            v_menu_item->'price',
            0
          ),
          0
        ),
        2
      );


    v_line_total :=
      round(
        v_unit_price * v_quantity,
        2
      );


    v_subtotal :=
      v_subtotal + v_line_total;


    ------------------------------------------------------------
    -- ITEM LIMPIO
    ------------------------------------------------------------

    v_clean_items :=
      v_clean_items
      ||
      jsonb_build_array(
        jsonb_build_object(

          'product_id',
          v_product_id,

          'product_name_snapshot',
          left(
            trim(
              coalesce(
                v_menu_item->>'name',
                'Producto'
              )
            ),
            200
          ),

          'unit_price_snapshot',
          v_unit_price,

          'quantity',
          v_quantity,

          'options_snapshot',
          jsonb_build_object(

            'description',
            left(
              coalesce(
                v_menu_item->>'description',
                ''
              ),
              1000
            ),

            'note',
            upper(
              left(
                coalesce(
                  v_requested_item #>>
                    '{options_snapshot,note}',
                  v_requested_item->>'note',
                  ''
                ),
                1000
              )
            ),

            'station',
            left(
              trim(
                coalesce(
                  v_menu_item->>'station',
                  'Cocina'
                )
              ),
              80
            )

          ),

          'total_snapshot',
          v_line_total,

          'name',
          left(
            trim(
              coalesce(
                v_menu_item->>'name',
                'Producto'
              )
            ),
            200
          ),

          'description',
          left(
            coalesce(
              v_menu_item->>'description',
              ''
            ),
            1000
          ),

          'price',
          v_unit_price,

          'qty',
          v_quantity,

          'note',
          upper(
            left(
              coalesce(
                v_requested_item->>'note',
                ''
              ),
              1000
            )
          ),

          'station',
          left(
            trim(
              coalesce(
                v_menu_item->>'station',
                'Cocina'
              )
            ),
            80
          )

        )
      );


    v_menu_item := null;

  end loop;


  --------------------------------------------------------------
  -- SUBTOTAL
  --------------------------------------------------------------

  v_subtotal :=
    round(
      v_subtotal,
      2
    );


  if v_subtotal <= 0
     or v_subtotal > 100000000
  then
    raise exception 'Invalid order total';
  end if;


  --------------------------------------------------------------
  -- DELIVERY
  --------------------------------------------------------------

  v_delivery :=
    coalesce(
      p_order_json->'delivery',
      'null'::jsonb
    );


  if p_order_type = 'Domicilio' then

    if jsonb_typeof(v_delivery) <> 'object' then
      raise exception 'Delivery information is required';
    end if;


    if length(
         trim(
           coalesce(
             v_delivery->>'phone',
             ''
           )
         )
       ) < 5
    then
      raise exception 'Delivery phone is required';
    end if;


    if length(
         trim(
           coalesce(
             v_delivery->>'address',
             ''
           )
         )
       ) < 5
    then
      raise exception 'Delivery address is required';
    end if;


    if v_restaurant_country = '' then
      raise exception
        'Restaurant country is not configured';
    end if;


    if upper(
         trim(
           coalesce(
             v_delivery->>'countryCode',
             ''
           )
         )
       ) <> v_restaurant_country
    then
      raise exception
        'Restaurant country does not match delivery country';
    end if;


    begin

      v_quote_id :=
        (v_delivery->>'quoteId')::uuid;

    exception
      when others then

        raise exception
          'Valid delivery quote is required';

    end;


    v_quote_token :=
      trim(
        coalesce(
          v_delivery->>'quoteToken',
          ''
        )
      );


    if length(v_quote_token) < 32 then
      raise exception
        'Valid delivery quote is required';
    end if;


    select dq.*
    into v_quote

    from public.delivery_quotes dq

    where dq.id = v_quote_id

    for update;


    if not found

       or v_quote.restaurant_user_id <> p_user_id

       or v_quote.token_hash <>
          encode(
            digest(
              v_quote_token,
              'sha256'
            ),
            'hex'
          )

       or v_quote.used_at is not null

       or v_quote.expires_at <= now()

       or (
         v_quote.customer_user_id is not null
         and
         v_quote.customer_user_id
           is distinct from auth.uid()
       )

    then

      raise exception
        'Delivery quote is invalid or expired';

    end if;


    v_fee :=
      v_quote.fee_breakdown;


    v_final_delivery :=
      v_quote.final_fee;


    v_currency :=
      v_quote.currency;


    v_delivery :=
      v_delivery
      ||
      jsonb_build_object(

        'distanceKm',
        v_quote.distance_km,

        'durationSeconds',
        v_quote.duration_seconds,

        'serverValidated',
        true,

        'quoteId',
        v_quote.id,

        'quoteExpiresAt',
        v_quote.expires_at,

        'fee',
        v_final_delivery,

        'feeBreakdown',
        v_fee

      )
      - 'quoteToken';

  else

    v_delivery := 'null'::jsonb;

  end if;


  --------------------------------------------------------------
  -- MONEDA
  --------------------------------------------------------------

  if v_currency = '' then

    v_currency :=
      case

        when v_restaurant_country = 'PL'
          then 'PLN'

        when v_restaurant_country = 'CO'
          then 'COP'

        else upper(
          left(
            coalesce(
              v_settings->>'currencyCode',
              ''
            ),
            3
          )
        )

      end;

  end if;


  if v_currency = '' then
    raise exception
      'Restaurant currency is not configured';
  end if;


  --------------------------------------------------------------
  -- TOTAL FINAL
  --------------------------------------------------------------

  v_final_total :=
    round(
      v_subtotal + v_final_delivery,
      2
    );


  --------------------------------------------------------------
  -- PAYLOAD ORIGINAL
  --------------------------------------------------------------

  v_payload :=
    (
      coalesce(
        p_order_json,
        '{}'::jsonb
      )
      - 'publicToken'
      - 'public_token'
    )

    ||

    jsonb_build_object(

      'items',
      v_clean_items,

      'delivery',
      v_delivery,

      'subtotal',
      v_subtotal,

      'total',
      v_final_total,

      'currency',
      v_currency,

      'pricingSource',
      'server-v86'

    );


  --------------------------------------------------------------
  -- INSERT ORIGINAL
  --------------------------------------------------------------

  insert into public.customer_orders (

    id,
    idempotency_key,
    public_token,
    user_id,
    customer_user_id,
    status,
    table_label,

    customer_name,
    order_type,
    order_json,
    total,
    currency,
    subtotal,

    base_delivery_fee,
    distance_fee,
    operational_adjustment,
    platform_adjustment,

    final_delivery_fee,

    payment_method,
    payment_status,
    payment_amount,
    payment_currency,

    created_at,
    updated_at

  ) values (

    v_order_id,
    v_order_id::text,

    encode(
      digest(
        trim(p_public_token),
        'sha256'
      ),
      'hex'
    ),

    p_user_id,
    auth.uid(),
    'pending',

    left(
      trim(
        coalesce(
          p_table_label,
          ''
        )
      ),
      160
    ),

    left(
      trim(p_customer_name),
      160
    ),

    p_order_type,
    v_payload,
    v_final_total,
    v_currency,
    v_subtotal,

    public.rc_ordera_jsonb_numeric(
      v_fee->'base',
      0
    ),

    public.rc_ordera_jsonb_numeric(
      v_fee->'distance',
      0
    ),

    public.rc_ordera_jsonb_numeric(
      v_fee->'operational',
      0
    ),

    public.rc_ordera_jsonb_numeric(
      v_fee->'platform',
      0
    ),

    v_final_delivery,

    v_payment_method,
    'pending',
    v_final_total,
    v_currency,

    now(),
    now()

  );


  --------------------------------------------------------------
  -- BOVEDA DEL TOKEN
  --------------------------------------------------------------

  insert into public.customer_order_access_secrets (

    customer_order_id,
    token_plaintext,
    created_at,
    updated_at

  ) values (

    v_order_id,
    trim(p_public_token),
    now(),
    now()

  )

  on conflict (
    customer_order_id
  )

  do update set

    token_plaintext =
      excluded.token_plaintext,

    updated_at =
      now();


  --------------------------------------------------------------
  -- MARCAR QUOTE COMO USADA
  --------------------------------------------------------------

  if p_order_type = 'Domicilio' then

    update public.delivery_quotes

    set
      used_at = now(),
      used_by_order_id = v_order_id

    where delivery_quotes.id = v_quote_id;

  end if;


  --------------------------------------------------------------
  -- RETURN
  --------------------------------------------------------------

  return query
  select
    v_order_id,
    trim(p_public_token);

end;
$function$;

DO $guard$ BEGIN IF (SELECT md5(btrim(regexp_replace(prosrc,'\s+',' ','g'))) FROM pg_proc WHERE oid=to_regprocedure('public.create_customer_order_v91_22_core(uuid,uuid,text,text,text,text,jsonb,numeric)')) IS DISTINCT FROM '9545dbd6502886000ca7168f4fc9ab13' THEN RAISE EXCEPTION 'POSTCHECK_FAILED'; END IF; END $guard$;

DO $guard$ BEGIN IF (SELECT md5(btrim(regexp_replace(prosrc,'\s+',' ','g'))) FROM pg_proc WHERE oid=to_regprocedure('public.update_my_station_order(uuid,uuid,text,text)')) IS DISTINCT FROM '8b8027fb720c542377c2bfba164c26b0' THEN RAISE EXCEPTION 'DEPLOYED_RPC_MISMATCH: public.update_my_station_order(uuid,uuid,text,text)'; END IF; END $guard$;

CREATE OR REPLACE FUNCTION public.update_my_station_order(p_restaurant_user_id uuid, p_order_id uuid, p_next_station_status text, p_station text)
 RETURNS TABLE(order_id uuid, order_status text, station_status text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_member_id uuid := auth.uid();
  v_station text := lower(trim(coalesce(p_station, '')));
  v_next text := lower(trim(coalesce(p_next_station_status, '')));
  v_current text;
  v_order_status text;
  v_order_station_status text;
begin
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_station not in (
    'waiter', 'cashier', 'manager', 'kitchen', 'grill', 'drinks',
    'fast_food', 'starters', 'salads', 'packing', 'dispatch'
  ) then
    raise exception 'Invalid station';
  end if;

  if not exists (
    select 1
    from public.restaurant_staff_memberships m
    where m.restaurant_user_id = p_restaurant_user_id
      and m.member_user_id = v_member_id
      and m.station = v_station
      and m.active = true
      and exists (select 1 from public.restaurant_profiles rp where rp.user_id = p_restaurant_user_id and rp.active = true and rp.deleted_at is null)
  ) then
    raise exception 'Station is not authorized';
  end if;

  select co.status, co.station_status
  into v_order_status, v_order_station_status
  from public.customer_orders co
  where co.id = p_order_id
    and co.user_id = p_restaurant_user_id
  for update;

  if not found or v_order_status not in ('accepted', 'sent') then
    raise exception 'Order is not active';
  end if;

  if v_station in (
    'kitchen', 'grill', 'drinks',
    'fast_food', 'starters', 'salads', 'packing'
  ) then

    select task.status
    into v_current
    from public.order_station_tasks task
    where task.customer_order_id = p_order_id
      and task.restaurant_user_id = p_restaurant_user_id
      and task.station = v_station
    for update;

    if not found then
      raise exception 'Station task was not found';
    end if;

    if v_station = 'packing' then
      -- Empaque solo puede actuar cuando TODA preparacion termino y el pedido global esta READY.
      if v_next <> 'packed'
         or v_current <> 'received'
         or v_order_station_status <> 'ready' then
        raise exception 'Station transition is not allowed';
      end if;

      if exists (
        select 1
        from public.order_station_tasks t
        where t.customer_order_id = p_order_id
          and t.restaurant_user_id = p_restaurant_user_id
          and t.station <> 'packing'
          and t.status not in ('ready', 'cancelled')
      ) then
        raise exception 'Station transition is not allowed';
      end if;

      update public.order_station_tasks
      set
        status = 'packed',
        completed_at = now(),
        updated_at = now()
      where customer_order_id = p_order_id
        and restaurant_user_id = p_restaurant_user_id
        and station = 'packing'
        and status = 'received';

      if not found then
        raise exception 'Station transition is not allowed';
      end if;

      update public.customer_orders
      set
        station_status = 'packed',
        updated_at = now()
      where id = p_order_id
        and user_id = p_restaurant_user_id
        and customer_orders.station_status = 'ready';

      if not found then
        raise exception 'Station transition is not allowed';
      end if;

    else

      if not (
        (v_current = 'received' and v_next = 'preparing')
        or
        (v_current = 'preparing' and v_next = 'ready')
      ) then
        raise exception 'Station transition is not allowed';
      end if;

      update public.order_station_tasks
      set
        status = v_next,
        started_at =
          case
            when v_next = 'preparing'
              then coalesce(started_at, now())
            else started_at
          end,
        completed_at =
          case
            when v_next = 'ready'
              then now()
            else completed_at
          end,
        updated_at = now()
      where customer_order_id = p_order_id
        and restaurant_user_id = p_restaurant_user_id
        and station = v_station;

      if not exists (
        select 1
        from public.order_station_tasks t
        where t.customer_order_id = p_order_id
          and t.restaurant_user_id = p_restaurant_user_id
          and t.station <> 'packing'
          and t.status not in ('ready', 'cancelled')
      ) then

        update public.order_station_tasks
        set
          status = 'received',
          updated_at = now()
        where customer_order_id = p_order_id
          and restaurant_user_id = p_restaurant_user_id
          and station = 'packing'
          and status = 'blocked';

        update public.customer_orders
        set
          station_status = 'ready',
          updated_at = now()
        where id = p_order_id
          and user_id = p_restaurant_user_id;

      else

        update public.customer_orders
        set
          station_status = 'preparing',
          updated_at = now()
        where id = p_order_id
          and user_id = p_restaurant_user_id;

      end if;
    end if;

  elsif v_station = 'dispatch' then

    if v_next = 'dispatched' then

      -- Flujo normal: PACKED -> DISPATCHED.
      -- Compatibilidad legacy: READY -> DISPATCHED solo cuando NO existe tarea activa de Empaque.
      update public.customer_orders as co_dispatch
      set
        station_status = 'dispatched',
        status = 'sent',
        updated_at = now()
      where co_dispatch.id = p_order_id
        and co_dispatch.user_id = p_restaurant_user_id
        and (
          co_dispatch.station_status = 'packed'
          or (
            co_dispatch.station_status = 'ready'
            and not exists (
              select 1
              from public.order_station_tasks packing_task
              where packing_task.customer_order_id = co_dispatch.id
                and packing_task.restaurant_user_id = p_restaurant_user_id
                and packing_task.station = 'packing'
                and packing_task.status <> 'cancelled'
            )
          )
        );

    elsif v_next = 'completed' then

      update public.customer_orders as co_dispatch
      set
        station_status = 'completed',
        status = 'delivered',
        updated_at = now()
      where co_dispatch.id = p_order_id
        and co_dispatch.user_id = p_restaurant_user_id
        and co_dispatch.station_status = 'dispatched';

    else
      raise exception 'Station transition is not allowed';
    end if;

    if not found then
      raise exception 'Station transition is not allowed';
    end if;

  elsif v_station not in ('manager', 'cashier') then

    raise exception 'Station transition is not allowed';

  else

    -- Se conserva exactamente la capacidad administrativa existente.
    if v_next not in (
      'received', 'preparing', 'ready',
      'packed', 'dispatched', 'completed', 'cancelled'
    ) then
      raise exception 'Station transition is not allowed';
    end if;

    update public.customer_orders
    set
      station_status = v_next,
      status =
        case
          when v_next = 'dispatched' then 'sent'
          when v_next = 'completed' then 'delivered'
          when v_next = 'cancelled' then 'cancelled'
          else status
        end,
      updated_at = now()
    where id = p_order_id
      and user_id = p_restaurant_user_id;

  end if;

  return query
  select
    co.id,
    co.status,
    case
      when v_station in (
        'kitchen', 'grill', 'drinks',
        'fast_food', 'starters', 'salads', 'packing'
      )
      then (
        select t.status
        from public.order_station_tasks t
        where t.customer_order_id = co.id
          and t.restaurant_user_id = p_restaurant_user_id
          and t.station = v_station
      )
      else co.station_status
    end,
    co.updated_at
  from public.customer_orders co
  where co.id = p_order_id
    and co.user_id = p_restaurant_user_id;
end;
$function$;

DO $guard$ BEGIN IF (SELECT md5(btrim(regexp_replace(prosrc,'\s+',' ','g'))) FROM pg_proc WHERE oid=to_regprocedure('public.update_my_station_order(uuid,uuid,text,text)')) IS DISTINCT FROM '09a6a6420166e5bf3914c309879ce44d' THEN RAISE EXCEPTION 'POSTCHECK_FAILED'; END IF; END $guard$;

COMMIT;
