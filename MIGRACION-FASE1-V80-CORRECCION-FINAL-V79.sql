-- RC ORDERA V80
-- Correccion final limitada posterior a V79.
-- 1. Amplia la cola administrativa de colaboradores con ubicacion completa.
-- 2. Documenta la version corregida de submit_waiter_order usada en produccion.
-- No elimina tablas, datos, usuarios, roles, pedidos, menus ni archivos.

begin;

do $preflight$
begin
  if to_regclass('public.courier_profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.restaurant_staff_memberships') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.app_settings') is null
     or to_regclass('public.customer_orders') is null then
    raise exception 'Falta la estructura base. Ejecuta primero las migraciones historicas hasta V76.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courier_profiles' and column_name = 'country_code'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courier_profiles' and column_name = 'region'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courier_profiles' and column_name = 'postal_code'
  ) then
    raise exception 'Faltan columnas de ubicacion de courier_profiles. Ejecuta primero la migracion V76.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'customer_orders'
      and c.conname = 'customer_orders_pkey'
      and c.contype = 'p'
  ) then
    raise exception 'No existe la restriccion public.customer_orders_pkey requerida por submit_waiter_order.';
  end if;
end;
$preflight$;

-- PostgreSQL no permite cambiar las columnas OUT con CREATE OR REPLACE.
-- La funcion se reemplaza dentro de esta misma transaccion; no se eliminan datos.
drop function if exists public.get_courier_review_queue();

create function public.get_courier_review_queue()
returns table (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  phone text,
  birth_date date,
  country text,
  city text,
  address text,
  identity_document text,
  identity_document_url text,
  photo_url text,
  verification_selfie_url text,
  work_permit_url text,
  vehicle_type text,
  vehicle_plate text,
  driver_license text,
  driver_license_url text,
  insurance_info text,
  insurance_url text,
  bank_account text,
  availability jsonb,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  country_code text,
  region text,
  postal_code text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_roles admin_role
    where admin_role.user_id = auth.uid()
      and admin_role.role = 'platform_admin'
      and admin_role.scope_type = 'platform'
      and admin_role.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
      and admin_role.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Not authorized to review couriers';
  end if;

  return query
  select
    cp.user_id,
    coalesce(au.email, '')::text,
    cp.first_name,
    cp.last_name,
    cp.phone,
    cp.birth_date,
    cp.country,
    cp.city,
    cp.address,
    cp.identity_document,
    cp.identity_document_url,
    cp.photo_url,
    cp.verification_selfie_url,
    cp.work_permit_url,
    cp.vehicle_type,
    cp.vehicle_plate,
    cp.driver_license,
    cp.driver_license_url,
    cp.insurance_info,
    cp.insurance_url,
    cp.bank_account,
    cp.availability,
    cp.status,
    cp.created_at,
    cp.updated_at,
    coalesce(cp.country_code, '')::text,
    coalesce(cp.region, '')::text,
    coalesce(cp.postal_code, '')::text
  from public.courier_profiles cp
  left join auth.users au on au.id = cp.user_id
  order by
    case cp.status
      when 'pending_review' then 0
      when 'draft' then 1
      when 'rejected' then 2
      when 'approved' then 3
      when 'suspended' then 4
      when 'inactive' then 5
      else 6
    end,
    cp.updated_at desc,
    cp.created_at desc;
end;
$$;

-- Misma firma, retorno y comportamiento de V71. El unico cambio funcional es
-- resolver el conflicto mediante el nombre de la clave primaria, sin ambiguedad.
create or replace function public.submit_waiter_order(
  p_id uuid,
  p_restaurant_user_id uuid,
  p_table_label text,
  p_customer_name text,
  p_order_type text,
  p_payment_method text,
  p_notes text,
  p_items jsonb
)
returns table (id uuid, total numeric, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid := auth.uid();
  v_membership public.restaurant_staff_memberships%rowtype;
  v_menu jsonb;
  v_item jsonb;
  v_product jsonb;
  v_category record;
  v_candidate jsonb;
  v_product_id text;
  v_quantity integer;
  v_price numeric(12,2);
  v_total numeric(12,2) := 0;
  v_validated_items jsonb := '[]'::jsonb;
  v_order_json jsonb;
  v_order_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;

  select m.*
  into v_membership
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = v_member_id
    and m.station in ('waiter', 'cashier', 'manager')
    and m.active = true
    and coalesce((m.permissions->>'create_orders')::boolean, false) = true
  order by case m.station when 'manager' then 1 when 'cashier' then 2 else 3 end
  limit 1;

  if not found then
    raise exception 'Waiter is not authorized for this restaurant';
  end if;

  if not exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = p_restaurant_user_id and rp.active = true
  ) then
    raise exception 'Restaurant is not active';
  end if;

  select coalesce(s.menu, '{}'::jsonb)
  into v_menu
  from public.app_settings s
  where s.user_id = p_restaurant_user_id;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Order has no items';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product := null;
    v_product_id := trim(coalesce(v_item->>'productId', v_item->>'product_id', ''));
    v_quantity := greatest(
      1,
      least(
        99,
        case
          when coalesce(v_item->>'qty', v_item->>'quantity', '') ~ '^[0-9]+$'
            then coalesce(v_item->>'qty', v_item->>'quantity')::integer
          else 1
        end
      )
    );

    for v_category in select key, value from jsonb_each(v_menu)
    loop
      if jsonb_typeof(v_category.value) = 'array' then
        select product.value
        into v_candidate
        from jsonb_array_elements(v_category.value) as product(value)
        where (
          v_product_id <> '' and trim(coalesce(product.value->>'id', product.value->>'productId', '')) = v_product_id
        )
        or (
          v_product_id = '' and lower(trim(product.value->>'name')) = lower(trim(v_item->>'name'))
        )
        limit 1;
        if v_candidate is not null then
          v_product := v_candidate;
          exit;
        end if;
      end if;
    end loop;

    if v_product is null then
      raise exception 'Menu product was not found';
    end if;
    if coalesce((v_product->>'available')::boolean, true) = false then
      raise exception 'Menu product is unavailable';
    end if;

    v_price := greatest(0, round(coalesce((v_product->>'price')::numeric, 0), 2));
    v_total := v_total + (v_price * v_quantity);
    v_validated_items := v_validated_items || jsonb_build_array(
      jsonb_build_object(
        'productId', coalesce(nullif(v_product->>'id', ''), v_product_id),
        'product_id', coalesce(nullif(v_product->>'id', ''), v_product_id),
        'name', coalesce(v_product->>'name', ''),
        'product_name_snapshot', coalesce(v_product->>'name', ''),
        'price', v_price,
        'unit_price_snapshot', v_price,
        'qty', v_quantity,
        'quantity', v_quantity,
        'total_snapshot', v_price * v_quantity,
        'note', upper(left(trim(coalesce(v_item->>'note', '')), 500))
      )
    );
  end loop;

  v_order_json := jsonb_build_object(
    'source', 'waiter',
    'serverName', v_membership.display_name,
    'type', coalesce(nullif(trim(p_order_type), ''), 'Comer en el punto'),
    'paymentMethod', coalesce(nullif(trim(p_payment_method), ''), 'Pago en caja'),
    'notes', upper(left(trim(coalesce(p_notes, '')), 1000)),
    'items', v_validated_items
  );

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
    source,
    created_by_user_id,
    server_name,
    created_at,
    updated_at
  )
  values (
    v_order_id,
    p_restaurant_user_id,
    null,
    'pending',
    left(trim(coalesce(p_table_label, '')), 120),
    left(trim(coalesce(p_customer_name, '')), 120),
    coalesce(nullif(trim(p_order_type), ''), 'Comer en el punto'),
    v_order_json,
    v_total,
    'waiter',
    v_member_id,
    v_membership.display_name,
    now(),
    now()
  )
  on conflict on constraint customer_orders_pkey do nothing;

  return query
  select co.id, co.total, co.created_at
  from public.customer_orders co
  where co.id = v_order_id
    and co.created_by_user_id = v_member_id
    and co.user_id = p_restaurant_user_id;
end;
$$;

revoke all on function public.get_courier_review_queue() from public, anon, authenticated;
revoke all on function public.submit_waiter_order(uuid, uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.get_courier_review_queue() to authenticated;
grant execute on function public.submit_waiter_order(uuid, uuid, text, text, text, text, text, jsonb) to authenticated;

do $verify$
declare
  v_waiter_definition text;
  v_queue_result text;
begin
  if to_regprocedure('public.get_courier_review_queue()') is null
     or to_regprocedure('public.submit_waiter_order(uuid,uuid,text,text,text,text,text,jsonb)') is null then
    raise exception 'No se pudieron crear las funciones V80.';
  end if;

  if has_function_privilege('anon', 'public.get_courier_review_queue()', 'EXECUTE')
     or has_function_privilege('anon', 'public.submit_waiter_order(uuid,uuid,text,text,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'El rol anon conserva permisos indebidos sobre las funciones V80.';
  end if;

  if not has_function_privilege('authenticated', 'public.get_courier_review_queue()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.submit_waiter_order(uuid,uuid,text,text,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'El rol authenticated no recibio los permisos V80.';
  end if;

  select pg_catalog.pg_get_function_result('public.get_courier_review_queue()'::regprocedure)
  into v_queue_result;
  if position('country_code text' in v_queue_result) = 0
     or position('region text' in v_queue_result) = 0
     or position('postal_code text' in v_queue_result) = 0 then
    raise exception 'La cola administrativa no expone toda la ubicacion requerida.';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.submit_waiter_order(uuid,uuid,text,text,text,text,text,jsonb)'::regprocedure
  ) into v_waiter_definition;
  if position(
    'ON CONFLICT ON CONSTRAINT CUSTOMER_ORDERS_PKEY DO NOTHING'
    in upper(v_waiter_definition)
  ) = 0 then
    raise exception 'submit_waiter_order no contiene la correccion de conflicto esperada.';
  end if;
end;
$verify$;

notify pgrst, 'reload schema';

commit;

-- Esta migracion es idempotente y puede volver a ejecutarse sin modificar datos.
