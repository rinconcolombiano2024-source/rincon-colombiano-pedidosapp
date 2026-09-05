-- RC ORDERA V91.05
-- Permite sincronizar/publicar pedidos internos POS aunque
-- el restaurante este cerrado para pedidos publicos.
--
-- Los pedidos CUSTOMER siguen bloqueados cuando el restaurante
-- esta cerrado.
--
-- Incremental e idempotente.
-- No elimina pedidos ni modifica historicos.

begin;


-- ============================================================
-- PREFLIGHT
-- ============================================================

do $preflight$
begin

  if to_regclass('public.customer_orders') is null then
    raise exception
      'Falta public.customer_orders. Ejecuta primero las migraciones anteriores.';
  end if;

  if to_regclass('public.restaurant_profiles') is null then
    raise exception
      'Falta public.restaurant_profiles. Ejecuta primero las migraciones anteriores.';
  end if;

end;
$preflight$;


-- ============================================================
-- PROTECCION DE RESTAURANTE CERRADO
--
-- IMPORTANTE:
--
-- customer / QR:
--   deben respetar el estado abierto/cerrado.
--
-- POS interno del propio restaurante:
--   debe poder persistir y sincronizar aunque el restaurante
--   este cerrado al publico.
-- ============================================================

create or replace function public.enforce_customer_order_restaurant_open()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare

  v_open boolean := false;

begin

  -- Operaciones internas administrativas del backend.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;


  -- ==========================================================
  -- PEDIDO INTERNO POS
  --
  -- Solo se permite saltar el control de "abierto" cuando:
  --
  -- 1. el origen es POS;
  -- 2. pertenece al restaurante autenticado;
  -- 3. fue creado por ese mismo restaurante;
  -- 4. ya es un pedido interno aceptado/enviado.
  --
  -- Esto NO abre pedidos publicos.
  -- ==========================================================

  if
    coalesce(new.source, 'customer') = 'pos'

    and new.user_id is not null

    and auth.uid() = new.user_id

    and new.created_by_user_id = new.user_id

    and coalesce(new.status, '') in (
      'accepted',
      'sent'
    )

  then

    return new;

  end if;


  -- ==========================================================
  -- PEDIDOS PUBLICOS / CLIENTE
  -- ==========================================================

  select

    case

      when rp.operational_mode = 'schedule' then

        public.restaurant_schedule_is_open(

          rp.opening_hours,

          coalesce(

            nullif(
              trim(rp.timezone),
              ''
            ),

            case
              upper(
                trim(
                  coalesce(
                    rp.country_code,
                    ''
                  )
                )
              )

              when 'PL' then
                'Europe/Warsaw'

              when 'CO' then
                'America/Bogota'

              else
                'UTC'

            end

          ),

          now()

        )

      else

        rp.operational_open

    end

  into v_open

  from public.restaurant_profiles rp

  where rp.user_id = new.user_id
    and rp.active = true
    and rp.deleted_at is null;


  if coalesce(v_open, false) is not true then

    raise exception
      'Restaurant is closed';

  end if;


  return new;

end;
$$;


-- ============================================================
-- ASEGURAR EL TRIGGER
-- ============================================================

drop trigger if exists
  enforce_customer_order_restaurant_open_trigger
on public.customer_orders;


create trigger enforce_customer_order_restaurant_open_trigger

before insert
on public.customer_orders

for each row

execute function
  public.enforce_customer_order_restaurant_open();


commit;


notify pgrst, 'reload schema';
