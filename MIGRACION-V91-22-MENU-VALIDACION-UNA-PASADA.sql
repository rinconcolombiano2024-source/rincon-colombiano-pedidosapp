-- ============================================================
-- RC ORDERA - V91-22 CORREGIDA
-- VALIDACION DE MENU EN UNA SOLA PASADA
--
-- Basada directamente en la funcion REAL instalada en produccion.
--
-- Cambios exclusivos:
--   1. Validacion anticipada de product_id.
--   2. Construccion de lookup de menu una sola vez.
--   3. Eliminacion de la busqueda completa del menu por cada item.
--
-- NO modifica ACL, tokens, delivery, precios, estados,
-- idempotencia ni contratos externos.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_id uuid,
  p_user_id uuid,
  p_public_token text,
  p_table_label text,
  p_customer_name text,
  p_order_type text,
  p_order_json jsonb,
  p_total numeric
)
RETURNS TABLE(
  id uuid,
  public_token text
)
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

    where id = v_quote_id;

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

COMMIT;
