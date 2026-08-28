-- RC ORDERA V71
-- Estacion movil de meseros y sincronizacion segura con la caja central.
-- Migracion incremental: no elimina tablas ni pedidos existentes.

create extension if not exists pgcrypto;

alter table public.customer_orders
  add column if not exists source text not null default 'customer',
  add column if not exists created_by_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists server_name text not null default '',
  add column if not exists station_status text not null default 'received';

alter table public.customer_orders
  drop constraint if exists customer_orders_source_check;

alter table public.customer_orders
  add constraint customer_orders_source_check
  check (source in ('customer', 'waiter'));

alter table public.customer_orders
  drop constraint if exists customer_orders_station_status_check;

alter table public.customer_orders
  add constraint customer_orders_station_status_check
  check (station_status in ('received', 'preparing', 'ready', 'packed', 'dispatched', 'completed', 'cancelled'));

create index if not exists customer_orders_restaurant_source_created_idx
  on public.customer_orders (user_id, source, created_at desc);

create index if not exists customer_orders_created_by_idx
  on public.customer_orders (created_by_user_id, created_at desc)
  where created_by_user_id is not null;

create index if not exists customer_orders_station_queue_idx
  on public.customer_orders (user_id, station_status, created_at desc);

create table if not exists public.restaurant_staff_memberships (
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  station text not null default 'waiter' check (
    station in ('waiter', 'cashier', 'kitchen', 'packing', 'dispatch', 'manager')
  ),
  display_name text not null default '',
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  granted_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_user_id, member_user_id, station)
);

create index if not exists restaurant_staff_member_active_idx
  on public.restaurant_staff_memberships (member_user_id, active, restaurant_user_id);

alter table public.restaurant_staff_memberships enable row level security;

drop policy if exists "Restaurant owners read own staff" on public.restaurant_staff_memberships;
create policy "Restaurant owners read own staff"
on public.restaurant_staff_memberships
for select
to authenticated
using (auth.uid() = restaurant_user_id);

drop policy if exists "Staff read own memberships" on public.restaurant_staff_memberships;
create policy "Staff read own memberships"
on public.restaurant_staff_memberships
for select
to authenticated
using (auth.uid() = member_user_id);

drop policy if exists "Staff read submitted station orders" on public.customer_orders;
create policy "Staff read submitted station orders"
on public.customer_orders
for select
to authenticated
using (auth.uid() = created_by_user_id);

drop policy if exists "Operational stations read active restaurant orders" on public.customer_orders;
create policy "Operational stations read active restaurant orders"
on public.customer_orders
for select
to authenticated
using (
  status in ('accepted', 'sent')
  and exists (
    select 1
    from public.restaurant_staff_memberships m
    join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
    where m.restaurant_user_id = customer_orders.user_id
      and m.member_user_id = auth.uid()
      and m.station in ('cashier', 'kitchen', 'packing', 'dispatch', 'manager')
      and m.active = true
      and rp.active = true
  )
);

create or replace function public.grant_current_restaurant_staff(
  p_email text,
  p_station text default 'waiter',
  p_display_name text default ''
)
returns table (
  member_user_id uuid,
  member_email text,
  station text,
  display_name text,
  active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_member_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_station text := lower(trim(coalesce(p_station, 'waiter')));
  v_display_name text := left(trim(coalesce(p_display_name, '')), 100);
begin
  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.restaurant_profiles rp
    join public.app_settings s on s.user_id = rp.user_id
    where rp.user_id = v_owner_id
      and rp.active = true
  ) then
    raise exception 'Restaurant owner profile is missing';
  end if;

  if v_station not in ('waiter', 'cashier', 'kitchen', 'packing', 'dispatch', 'manager') then
    raise exception 'Invalid station';
  end if;

  if v_email = '' then
    raise exception 'Employee email is required';
  end if;

  select au.id
  into v_member_id
  from auth.users au
  where lower(au.email) = v_email
  limit 1;

  if v_member_id is null then
    raise exception 'Employee account was not found';
  end if;

  update public.restaurant_staff_memberships
  set active = false, updated_at = now()
  where restaurant_user_id = v_owner_id
    and member_user_id = v_member_id
    and station <> v_station
    and active = true;

  insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
  values (v_member_id, 'restaurant_employee', 'restaurant', v_owner_id, 'active', now())
  on conflict (user_id, role, scope_type, scope_id)
  do update set status = 'active', updated_at = now();

  insert into public.restaurant_staff_memberships (
    restaurant_user_id,
    member_user_id,
    station,
    display_name,
    permissions,
    active,
    granted_by_user_id,
    updated_at
  )
  values (
    v_owner_id,
    v_member_id,
    v_station,
    coalesce(nullif(v_display_name, ''), split_part(v_email, '@', 1)),
    case
      when v_station in ('waiter', 'cashier', 'manager') then '{"create_orders":true}'::jsonb
      else '{}'::jsonb
    end,
    true,
    v_owner_id,
    now()
  )
  on conflict (restaurant_user_id, member_user_id, station)
  do update set
    display_name = excluded.display_name,
    permissions = excluded.permissions,
    active = true,
    granted_by_user_id = v_owner_id,
    updated_at = now();

  return query
  select
    m.member_user_id,
    coalesce(au.email, '')::text,
    m.station,
    m.display_name,
    m.active
  from public.restaurant_staff_memberships m
  join auth.users au on au.id = m.member_user_id
  where m.restaurant_user_id = v_owner_id
    and m.member_user_id = v_member_id
    and m.station = v_station;
end;
$$;

create or replace function public.list_current_restaurant_staff()
returns table (
  member_user_id uuid,
  member_email text,
  station text,
  display_name text,
  active boolean,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    m.member_user_id,
    coalesce(au.email, '')::text,
    m.station,
    m.display_name,
    m.active,
    m.updated_at
  from public.restaurant_staff_memberships m
  join auth.users au on au.id = m.member_user_id
  where m.restaurant_user_id = auth.uid()
  order by m.active desc, m.display_name, m.station;
$$;

create or replace function public.set_current_restaurant_staff_active(
  p_member_user_id uuid,
  p_station text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_station text := lower(trim(coalesce(p_station, '')));
begin
  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.restaurant_staff_memberships
  set active = coalesce(p_active, false), updated_at = now()
  where restaurant_user_id = v_owner_id
    and member_user_id = p_member_user_id
    and station = v_station;

  if not found then
    raise exception 'Staff membership was not found';
  end if;

  if coalesce(p_active, false) = false
     and not exists (
       select 1
       from public.restaurant_staff_memberships m
       where m.restaurant_user_id = v_owner_id
         and m.member_user_id = p_member_user_id
         and m.active = true
     ) then
    update public.user_roles
    set status = 'revoked', updated_at = now()
    where user_id = p_member_user_id
      and role = 'restaurant_employee'
      and scope_type = 'restaurant'
      and scope_id = v_owner_id;
  elsif coalesce(p_active, false) = true then
    insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
    values (p_member_user_id, 'restaurant_employee', 'restaurant', v_owner_id, 'active', now())
    on conflict (user_id, role, scope_type, scope_id)
    do update set status = 'active', updated_at = now();
  end if;
end;
$$;

create or replace function public.get_my_restaurant_station(p_restaurant_user_id uuid)
returns table (
  restaurant_user_id uuid,
  station text,
  display_name text,
  permissions jsonb,
  business_name text,
  logo_url text,
  active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    m.restaurant_user_id,
    m.station,
    m.display_name,
    m.permissions,
    coalesce(nullif(rp.business_name, ''), 'Restaurante')::text,
    coalesce(rp.logo_url, '')::text,
    m.active
  from public.restaurant_staff_memberships m
  join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = auth.uid()
    and m.active = true
    and rp.active = true
  order by case m.station when 'manager' then 1 when 'cashier' then 2 when 'waiter' then 3 else 4 end
  limit 1;
$$;

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
  on conflict (id) do nothing;

  return query
  select co.id, co.total, co.created_at
  from public.customer_orders co
  where co.id = v_order_id
    and co.created_by_user_id = v_member_id
    and co.user_id = p_restaurant_user_id;
end;
$$;

create or replace function public.list_my_station_orders(p_restaurant_user_id uuid)
returns table (
  order_id uuid,
  order_status text,
  station_status text,
  table_label text,
  customer_name text,
  order_type text,
  items jsonb,
  notes text,
  source text,
  server_name text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid := auth.uid();
begin
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.restaurant_staff_memberships m
    join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
    where m.restaurant_user_id = p_restaurant_user_id
      and m.member_user_id = v_member_id
      and m.active = true
      and rp.active = true
  ) then
    raise exception 'Station is not authorized';
  end if;

  return query
  select
    co.id,
    co.status,
    co.station_status,
    co.table_label,
    co.customer_name,
    co.order_type,
    coalesce(co.order_json->'items', '[]'::jsonb),
    upper(left(coalesce(co.order_json->>'notes', ''), 1000)),
    co.source,
    co.server_name,
    co.created_at,
    co.updated_at
  from public.customer_orders co
  where co.user_id = p_restaurant_user_id
    and co.status in ('accepted', 'sent')
    and co.station_status not in ('completed', 'cancelled')
    and co.created_at >= now() - interval '36 hours'
  order by co.created_at asc
  limit 100;
end;
$$;

create or replace function public.update_my_station_order(
  p_restaurant_user_id uuid,
  p_order_id uuid,
  p_next_station_status text
)
returns table (
  order_id uuid,
  order_status text,
  station_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid := auth.uid();
  v_station text;
  v_next text := lower(trim(coalesce(p_next_station_status, '')));
  v_current text;
  v_order_status text;
  v_allowed boolean := false;
begin
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;

  select m.station
  into v_station
  from public.restaurant_staff_memberships m
  join public.restaurant_profiles rp on rp.user_id = m.restaurant_user_id
  where m.restaurant_user_id = p_restaurant_user_id
    and m.member_user_id = v_member_id
    and m.active = true
    and rp.active = true
  order by case m.station
    when 'manager' then 1
    when 'cashier' then 2
    when 'kitchen' then 3
    when 'packing' then 4
    when 'dispatch' then 5
    else 6
  end
  limit 1;

  if v_station is null then
    raise exception 'Station is not authorized';
  end if;

  select co.station_status, co.status
  into v_current, v_order_status
  from public.customer_orders co
  where co.id = p_order_id
    and co.user_id = p_restaurant_user_id
  for update;

  if not found or v_order_status not in ('accepted', 'sent') then
    raise exception 'Order is not active';
  end if;

  if v_station in ('manager', 'cashier') then
    v_allowed := v_next in ('received', 'preparing', 'ready', 'packed', 'dispatched', 'completed', 'cancelled');
  elsif v_station = 'kitchen' then
    v_allowed := v_next in ('preparing', 'ready')
      and v_current in ('received', 'preparing');
  elsif v_station = 'packing' then
    v_allowed := v_next = 'packed'
      and v_current in ('received', 'preparing', 'ready');
  elsif v_station = 'dispatch' then
    v_allowed := (v_next = 'dispatched' and v_current in ('received', 'preparing', 'ready', 'packed'))
      or (v_next = 'completed' and v_current in ('ready', 'packed', 'dispatched'));
  end if;

  if not v_allowed then
    raise exception 'Station transition is not allowed';
  end if;

  update public.customer_orders co
  set
    station_status = v_next,
    status = case
      when v_next = 'dispatched' then 'sent'
      when v_next = 'completed' then 'delivered'
      when v_next = 'cancelled' then 'cancelled'
      else co.status
    end,
    updated_at = now()
  where co.id = p_order_id
    and co.user_id = p_restaurant_user_id;

  return query
  select co.id, co.status, co.station_status, co.updated_at
  from public.customer_orders co
  where co.id = p_order_id
    and co.user_id = p_restaurant_user_id;
end;
$$;

grant select on public.restaurant_staff_memberships to authenticated;
grant execute on function public.grant_current_restaurant_staff(text, text, text) to authenticated;
grant execute on function public.list_current_restaurant_staff() to authenticated;
grant execute on function public.set_current_restaurant_staff_active(uuid, text, boolean) to authenticated;
grant execute on function public.get_my_restaurant_station(uuid) to authenticated;
grant execute on function public.submit_waiter_order(uuid, uuid, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.list_my_station_orders(uuid) to authenticated;
grant execute on function public.update_my_station_order(uuid, uuid, text) to authenticated;

-- Repara de forma idempotente el cierre/eliminacion logica del restaurante.
-- Los pedidos e informes historicos se conservan.
create or replace function public.set_current_restaurant_active(p_active boolean)
returns table (
  restaurant_user_id uuid,
  restaurant_active boolean,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_name text := 'Restaurante';
  v_logo_url text := '';
  v_public_address text := '';
  v_phone text := '';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.restaurant_profiles rp where rp.user_id = v_user_id
  ) and not exists (
    select 1 from public.app_settings s where s.user_id = v_user_id
  ) then
    raise exception 'Restaurant profile not found';
  end if;

  select
    coalesce(nullif(trim(s.settings->>'businessName'), ''), 'Restaurante'),
    coalesce(s.settings->>'businessLogoUrl', ''),
    coalesce(nullif(trim(s.settings->>'restaurantAddress'), ''), nullif(trim(s.settings->>'legalAddress'), ''), ''),
    coalesce(s.settings->>'businessPhone', '')
  into v_business_name, v_logo_url, v_public_address, v_phone
  from public.app_settings s
  where s.user_id = v_user_id;

  insert into public.restaurant_profiles (
    user_id, business_name, logo_url, public_address, phone, active, updated_at
  )
  values (
    v_user_id,
    coalesce(nullif(trim(v_business_name), ''), 'Restaurante'),
    coalesce(v_logo_url, ''),
    coalesce(v_public_address, ''),
    coalesce(v_phone, ''),
    p_active,
    now()
  )
  on conflict (user_id)
  do update set active = excluded.active, updated_at = now();

  update public.app_settings
  set settings = coalesce(settings, '{}'::jsonb)
      || jsonb_build_object('restaurantActive', p_active),
      updated_at = now()
  where user_id = v_user_id;

  return query
  select rp.user_id, rp.active, rp.updated_at
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;
end;
$$;

create or replace function public.request_current_restaurant_deletion()
returns table (
  restaurant_user_id uuid,
  restaurant_active boolean,
  changed_at timestamptz,
  privacy_request_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_business_name text := '';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.set_current_restaurant_active(false);

  select rp.business_name into v_business_name
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;

  select apr.id into v_request_id
  from public.account_privacy_requests apr
  where apr.user_id = v_user_id
    and apr.request_type = 'restaurant_deletion'
    and apr.status in ('requested', 'in_review')
  order by apr.created_at desc
  limit 1;

  if v_request_id is null then
    insert into public.account_privacy_requests (
      user_id, request_type, role_context, status, details
    )
    values (
      v_user_id,
      'restaurant_deletion',
      'restaurant_owner',
      'requested',
      jsonb_build_object(
        'businessName', coalesce(v_business_name, ''),
        'requestedAt', now()
      )
    )
    returning id into v_request_id;
  end if;

  return query
  select rp.user_id, rp.active, rp.updated_at, v_request_id
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;
end;
$$;

revoke all on function public.set_current_restaurant_active(boolean) from public;
revoke all on function public.request_current_restaurant_deletion() from public;
grant execute on function public.set_current_restaurant_active(boolean) to authenticated;
grant execute on function public.request_current_restaurant_deletion() to authenticated;

alter table public.customer_orders replica identity full;
alter table public.restaurant_profiles replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_orders'
  ) then
    alter publication supabase_realtime add table public.customer_orders;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'restaurant_profiles'
  ) then
    alter publication supabase_realtime add table public.restaurant_profiles;
  end if;
end
$$;
