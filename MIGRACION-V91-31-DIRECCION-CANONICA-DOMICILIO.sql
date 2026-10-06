-- ============================================================
-- RC ORDERA V91-31
-- DESTINO CANONICO PARA PEDIDOS A DOMICILIO
--
-- Fuente:
--   definición instalada y verificada en producción.
--
-- Objetivo:
--   - El navegador NO decide la dirección final de entrega.
--   - El navegador NO decide las coordenadas finales.
--   - El navegador NO decide distancia, duración ni tarifa.
--   - La cotización persistida en delivery_quotes es la autoridad.
--
-- Esta migración es incremental e idempotente.
-- No elimina pedidos.
-- No modifica pagos.
-- No modifica estados.
-- No consume cotizaciones.
-- ============================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';


-- ============================================================
-- 1. PREFLIGHT
-- ============================================================

do $preflight$
declare
  v_column text;
begin

  if to_regclass('public.customer_orders') is null then
    raise exception
      'V91-31: falta public.customer_orders';
  end if;

  if to_regclass('public.delivery_quotes') is null then
    raise exception
      'V91-31: falta public.delivery_quotes';
  end if;


  -- ----------------------------------------------------------
  -- customer_orders
  -- ----------------------------------------------------------

  foreach v_column in array array[
    'id',
    'user_id',
    'order_type',
    'order_json'
  ]
  loop

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customer_orders'
        and column_name = v_column
    ) then

      raise exception
        'V91-31: falta customer_orders.%', v_column;

    end if;

  end loop;


  -- ----------------------------------------------------------
  -- delivery_quotes
  -- ----------------------------------------------------------

  foreach v_column in array array[
    'id',
    'restaurant_user_id',
    'expires_at',
    'used_at',
    'used_by_order_id',
    'destination_lat',
    'destination_lng',
    'destination_address',
    'destination_country_code',
    'destination_region',
    'distance_km',
    'duration_seconds',
    'final_fee',
    'fee_breakdown'
  ]
  loop

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'delivery_quotes'
        and column_name = v_column
    ) then

      raise exception
        'V91-31: falta delivery_quotes.%', v_column;

    end if;

  end loop;

end;
$preflight$;



-- ============================================================
-- 2. FUNCION CANONICA
--
-- Definición reproducida desde producción.
-- ============================================================

create or replace function
public.rc_ordera_enforce_canonical_delivery_destination()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'extensions'
as $function$
declare

  v_delivery jsonb;
  v_quote_id uuid;
  v_quote public.delivery_quotes%rowtype;
  v_location jsonb;

begin

  -- ----------------------------------------------------------
  -- Solo aplica para domicilios.
  -- ----------------------------------------------------------

  if coalesce(new.order_type, '') <> 'Domicilio' then
    return new;
  end if;


  -- ----------------------------------------------------------
  -- El JSON del pedido debe existir.
  -- ----------------------------------------------------------

  if new.order_json is null
     or jsonb_typeof(new.order_json) <> 'object' then

    raise exception
      'Delivery order JSON is required';

  end if;


  v_delivery :=
    coalesce(
      new.order_json -> 'delivery',
      '{}'::jsonb
    );


  if jsonb_typeof(v_delivery) <> 'object' then
    raise exception
      'Delivery information is required';
  end if;


  -- ----------------------------------------------------------
  -- Obtener quoteId.
  -- ----------------------------------------------------------

  begin

    v_quote_id :=
      nullif(
        trim(
          coalesce(
            v_delivery ->> 'quoteId',
            ''
          )
        ),
        ''
      )::uuid;

  exception
    when others then

      raise exception
        'Valid delivery quote is required';

  end;


  if v_quote_id is null then

    raise exception
      'Valid delivery quote is required';

  end if;


  -- ----------------------------------------------------------
  -- Cargar la cotizacion REAL del servidor.
  --
  -- Debe pertenecer al mismo restaurante.
  -- ----------------------------------------------------------

  select dq.*
  into v_quote
  from public.delivery_quotes dq
  where dq.id = v_quote_id
    and dq.restaurant_user_id = new.user_id
  for share;


  if not found then

    raise exception
      'Delivery quote does not belong to this restaurant';

  end if;


  -- ----------------------------------------------------------
  -- La cotizacion debe seguir vigente.
  --
  -- Si ya fue utilizada, solo se permite si pertenece
  -- exactamente a ESTE pedido.
  -- ----------------------------------------------------------

  if
    v_quote.expires_at <= now()
    and v_quote.used_by_order_id is distinct from new.id
  then

    raise exception
      'Delivery quote is expired';

  end if;


  if
    v_quote.used_at is not null
    and v_quote.used_by_order_id is distinct from new.id
  then

    raise exception
      'Delivery quote was already used by another order';

  end if;


  -- ----------------------------------------------------------
  -- Un domicilio debe tener coordenadas verificadas.
  -- ----------------------------------------------------------

  if
    v_quote.destination_lat is null
    or v_quote.destination_lng is null
  then

    raise exception
      'Delivery quote has no verified destination coordinates';

  end if;


  -- ----------------------------------------------------------
  -- Construir GPS CANONICO.
  --
  -- El navegador ya NO decide estas coordenadas.
  -- ----------------------------------------------------------

  v_location :=
    jsonb_build_object(
      'lat',
      v_quote.destination_lat,

      'lng',
      v_quote.destination_lng
    );


  -- ----------------------------------------------------------
  -- REEMPLAZAR datos sensibles enviados por navegador.
  --
  -- Los valores del servidor reemplazan cualquier valor
  -- enviado por el cliente.
  -- ----------------------------------------------------------

  v_delivery :=
    (
      v_delivery
      - 'quoteToken'
    )
    ||
    jsonb_build_object(

      'address',
      v_quote.destination_address,

      'verifiedAddress',
      v_quote.destination_address,

      'countryCode',
      v_quote.destination_country_code,

      'region',
      v_quote.destination_region,

      'location',
      v_location,

      'verifiedLocation',
      v_location,

      'distanceKm',
      v_quote.distance_km,

      'durationSeconds',
      v_quote.duration_seconds,

      'quoteId',
      v_quote.id,

      'quoteExpiresAt',
      v_quote.expires_at,

      'fee',
      v_quote.final_fee,

      'calculatedFee',
      v_quote.final_fee,

      'feeBreakdown',
      v_quote.fee_breakdown,

      'mapDestination',
      v_quote.destination_address,

      'serverValidated',
      true
    );


  -- ----------------------------------------------------------
  -- Guardar delivery protegido dentro del pedido.
  -- ----------------------------------------------------------

  new.order_json :=
    jsonb_set(
      new.order_json,
      '{delivery}',
      v_delivery,
      true
    );


  return new;

end;
$function$;



-- ============================================================
-- 3. PERMISOS
--
-- Producción verificada:
--
-- owner          = postgres
-- anon           = NO EXECUTE
-- authenticated  = NO EXECUTE
-- service_role   = EXECUTE
-- ============================================================

revoke all on function
public.rc_ordera_enforce_canonical_delivery_destination()
from public;

revoke all on function
public.rc_ordera_enforce_canonical_delivery_destination()
from anon;

revoke all on function
public.rc_ordera_enforce_canonical_delivery_destination()
from authenticated;

grant execute on function
public.rc_ordera_enforce_canonical_delivery_destination()
to service_role;



-- ============================================================
-- 4. TRIGGER
--
-- Definición reproducida desde producción.
-- ============================================================

drop trigger if exists
trg_rc_ordera_canonical_delivery_destination
on public.customer_orders;


create trigger
trg_rc_ordera_canonical_delivery_destination
before insert
or update of order_json, order_type, user_id
on public.customer_orders
for each row
execute function
public.rc_ordera_enforce_canonical_delivery_destination();



-- ============================================================
-- 5. POSTCHECK
-- ============================================================

do $postcheck$
declare
  v_security_definer boolean;
  v_config text[];
begin

  if to_regprocedure(
    'public.rc_ordera_enforce_canonical_delivery_destination()'
  ) is null then

    raise exception
      'V91-31 POSTCHECK: falta la funcion canonica';

  end if;


  select
    p.prosecdef,
    p.proconfig
  into
    v_security_definer,
    v_config
  from pg_catalog.pg_proc p
  where p.oid =
    'public.rc_ordera_enforce_canonical_delivery_destination()'
      ::regprocedure;


  if v_security_definer is distinct from true then

    raise exception
      'V91-31 POSTCHECK: la funcion no es SECURITY DEFINER';

  end if;


  if not (
    coalesce(
      v_config,
      array[]::text[]
    )
    @>
    array[
      'search_path=pg_catalog, public, extensions'
    ]::text[]
  ) then

    raise exception
      'V91-31 POSTCHECK: search_path incorrecto: %',
      v_config;

  end if;


  if has_function_privilege(
    'anon',
    'public.rc_ordera_enforce_canonical_delivery_destination()',
    'EXECUTE'
  ) then

    raise exception
      'V91-31 SECURITY ERROR: anon conserva EXECUTE';

  end if;


  if has_function_privilege(
    'authenticated',
    'public.rc_ordera_enforce_canonical_delivery_destination()',
    'EXECUTE'
  ) then

    raise exception
      'V91-31 SECURITY ERROR: authenticated conserva EXECUTE';

  end if;


  if not has_function_privilege(
    'service_role',
    'public.rc_ordera_enforce_canonical_delivery_destination()',
    'EXECUTE'
  ) then

    raise exception
      'V91-31 SECURITY ERROR: service_role no tiene EXECUTE';

  end if;


  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c
      on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'customer_orders'
      and t.tgname =
        'trg_rc_ordera_canonical_delivery_destination'
      and not t.tgisinternal
      and t.tgfoid =
        'public.rc_ordera_enforce_canonical_delivery_destination()'
          ::regprocedure
  ) then

    raise exception
      'V91-31 POSTCHECK: falta el trigger canonico';

  end if;

end;
$postcheck$;


commit;
