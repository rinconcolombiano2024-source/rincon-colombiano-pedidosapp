-- RC ORDERA V84
-- Contratos incrementales para UX, crecimiento, soporte y finanzas preparadas.
-- Ejecutar despues de V82 y V83. No activa proveedores de pago ni cobros online.
-- Idempotente y no destructiva: no elimina ni transforma datos existentes.

begin;

do $preflight$
begin
  if to_regclass('public.customer_orders') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.restaurant_staff_memberships') is null
     or to_regclass('public.order_status_history') is null
     or to_regprocedure('public.rc_ordera_is_platform_admin(uuid)') is null
     or to_regprocedure('public.rc_ordera_can_access_order(uuid)') is null then
    raise exception 'Falta el nucleo de RC ORDERA. Ejecuta primero V82 y V83.';
  end if;
end;
$preflight$;

create or replace function public.rc_ordera_can_manage_restaurant(
  p_restaurant_user_id uuid,
  p_permission text default 'manage_settings'
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and (
    auth.uid() = p_restaurant_user_id
    or public.rc_ordera_is_platform_admin(auth.uid())
    or exists (
      select 1
      from public.restaurant_staff_memberships m
      where m.restaurant_user_id = p_restaurant_user_id
        and m.member_user_id = auth.uid()
        and m.active = true
        and (
          m.station = 'manager'
          or lower(coalesce(m.permissions->>p_permission, 'false')) in ('true', 't', '1', 'yes')
        )
    )
  );
$$;

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Casa',
  country_code text not null default '',
  region text not null default '',
  city text not null default '',
  postal_code text not null default '',
  street text not null default '',
  street_number text not null default '',
  apartment text not null default '',
  floor text not null default '',
  neighborhood text not null default '',
  reference text not null default '',
  latitude numeric(10, 7) null,
  longitude numeric(10, 7) null,
  delivery_instruction text not null default '',
  delivery_option text not null default 'door' check (
    delivery_option in ('door', 'meet_outside', 'reception', 'leave_at_door', 'call')
  ),
  is_default boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create index if not exists customer_addresses_owner_active_idx
  on public.customer_addresses (customer_user_id, is_default desc, updated_at desc)
  where deleted_at is null;

create unique index if not exists customer_addresses_one_default_idx
  on public.customer_addresses (customer_user_id)
  where is_default = true and deleted_at is null;

create table if not exists public.customer_favorites (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  favorite_type text not null check (favorite_type in ('restaurant', 'product')),
  product_id text not null default '',
  created_at timestamptz not null default now(),
  check (
    (favorite_type = 'restaurant' and product_id = '')
    or (favorite_type = 'product' and product_id <> '')
  ),
  unique (customer_user_id, restaurant_user_id, favorite_type, product_id)
);

create index if not exists customer_favorites_owner_idx
  on public.customer_favorites (customer_user_id, favorite_type, created_at desc);

create table if not exists public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  translations jsonb not null default '{}'::jsonb,
  required boolean not null default false,
  min_selections integer not null default 0 check (min_selections >= 0),
  max_selections integer not null default 1 check (max_selections > 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_selections >= min_selections)
);

create table if not exists public.modifiers (
  id uuid primary key default gen_random_uuid(),
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  translations jsonb not null default '{}'::jsonb,
  price_adjustment numeric(12, 2) not null default 0,
  currency text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_modifier_groups (
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (restaurant_user_id, product_id, modifier_group_id)
);

create index if not exists modifier_groups_restaurant_active_idx
  on public.modifier_groups (restaurant_user_id, active, sort_order)
  where deleted_at is null;

create index if not exists modifiers_group_active_idx
  on public.modifiers (modifier_group_id, active, sort_order)
  where deleted_at is null;

create table if not exists public.product_availability_overrides (
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  availability_status text not null default 'available' check (
    availability_status in ('available', 'sold_out', 'until_time', 'until_tomorrow')
  ),
  unavailable_until timestamptz null,
  reason text not null default '',
  updated_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_user_id, product_id)
);

create table if not exists public.restaurant_special_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  service_date date not null,
  closed boolean not null default false,
  opens_at time null,
  closes_at time null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_user_id, service_date),
  check (closed or (opens_at is not null and closes_at is not null))
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  promotion_type text not null check (
    promotion_type in ('percentage', 'fixed', 'two_for_one', 'free_delivery', 'combo')
  ),
  value numeric(12, 2) not null default 0,
  minimum_order numeric(12, 2) not null default 0,
  currency text not null default '',
  rules jsonb not null default '{}'::jsonb,
  starts_at timestamptz null,
  ends_at timestamptz null,
  active boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists promotions_restaurant_active_idx
  on public.promotions (restaurant_user_id, active, starts_at, ends_at)
  where deleted_at is null;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders(id) on delete restrict,
  customer_user_id uuid not null references auth.users(id) on delete restrict,
  restaurant_user_id uuid not null references auth.users(id) on delete restrict,
  courier_user_id uuid null references auth.users(id) on delete set null,
  restaurant_rating smallint not null check (restaurant_rating between 1 and 5),
  food_rating smallint not null check (food_rating between 1 and 5),
  courier_rating smallint null check (courier_rating between 1 and 5),
  overall_rating smallint not null check (overall_rating between 1 and 5),
  comment text not null default '',
  status text not null default 'published' check (status in ('published', 'reported', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_order_id, customer_user_id)
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  actor_role text not null check (actor_role in ('customer', 'restaurant', 'courier', 'admin')),
  restaurant_user_id uuid null references auth.users(id) on delete set null,
  customer_order_id uuid null references public.customer_orders(id) on delete restrict,
  category text not null,
  subject text not null,
  description text not null default '',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_review', 'waiting_user', 'resolved', 'closed')),
  assigned_to_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz null
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  support_ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null default '',
  attachment_path text not null default '',
  created_at timestamptz not null default now(),
  check (body <> '' or attachment_path <> '')
);

create index if not exists support_tickets_actor_status_idx
  on public.support_tickets (created_by_user_id, status, updated_at desc);

create index if not exists support_messages_ticket_created_idx
  on public.support_messages (support_ticket_id, created_at asc);

create table if not exists public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete restrict,
  restaurant_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'inactive' check (status in ('inactive', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_user_id, restaurant_user_id)
);

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  loyalty_account_id uuid not null references public.loyalty_accounts(id) on delete restrict,
  customer_order_id uuid null references public.customer_orders(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('earn', 'redeem', 'expire', 'adjustment')),
  points integer not null check (points <> 0),
  reason text not null default '',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (loyalty_account_id, idempotency_key)
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  points_cost integer not null check (points_cost > 0),
  rules jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Preparacion financiera. Estas tablas no activan ningun proveedor ni permiten
-- marcar pagos exitosos desde el navegador.
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders(id) on delete restrict,
  provider text not null default '',
  provider_reference text not null default '',
  payment_method text not null default '',
  status text not null default 'pending' check (
    status in ('pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded')
  ),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  authorized_at timestamptz null,
  paid_at timestamptz null,
  failed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_order_id, idempotency_key)
);

create unique index if not exists payment_transactions_provider_reference_idx
  on public.payment_transactions (provider, provider_reference)
  where provider <> '' and provider_reference <> '';

create table if not exists public.refund_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
  customer_order_id uuid not null references public.customer_orders(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'processing', 'refunded', 'failed')),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null,
  reason text not null default '',
  provider_reference text not null default '',
  idempotency_key text not null,
  requested_by_user_id uuid null references auth.users(id) on delete set null,
  processed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_transaction_id, idempotency_key)
);

create table if not exists public.courier_settlements (
  id uuid primary key default gen_random_uuid(),
  courier_user_id uuid not null references auth.users(id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  delivery_amount numeric(12, 2) not null default 0,
  tip_amount numeric(12, 2) not null default 0,
  adjustment_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  currency text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'cancelled')),
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start)
);

alter table public.customer_addresses enable row level security;
alter table public.customer_favorites enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifiers enable row level security;
alter table public.product_modifier_groups enable row level security;
alter table public.product_availability_overrides enable row level security;
alter table public.restaurant_special_hours enable row level security;
alter table public.promotions enable row level security;
alter table public.reviews enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.refund_transactions enable row level security;
alter table public.courier_settlements enable row level security;

drop policy if exists "Customers manage own addresses" on public.customer_addresses;
create policy "Customers manage own addresses" on public.customer_addresses
for all to authenticated
using (customer_user_id = auth.uid())
with check (customer_user_id = auth.uid());

drop policy if exists "Customers manage own favorites" on public.customer_favorites;
create policy "Customers manage own favorites" on public.customer_favorites
for all to authenticated
using (customer_user_id = auth.uid())
with check (customer_user_id = auth.uid());

drop policy if exists "Public reads active modifier groups" on public.modifier_groups;
create policy "Public reads active modifier groups" on public.modifier_groups
for select to anon, authenticated
using (
  active = true and deleted_at is null and exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = modifier_groups.restaurant_user_id
      and rp.active = true and rp.deleted_at is null
  )
);

drop policy if exists "Restaurants manage modifier groups" on public.modifier_groups;
create policy "Restaurants manage modifier groups" on public.modifier_groups
for all to authenticated
using (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'edit_menu'))
with check (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'edit_menu'));

drop policy if exists "Public reads active modifiers" on public.modifiers;
create policy "Public reads active modifiers" on public.modifiers
for select to anon, authenticated
using (
  active = true and deleted_at is null and exists (
    select 1 from public.modifier_groups mg
    join public.restaurant_profiles rp on rp.user_id = mg.restaurant_user_id
    where mg.id = modifiers.modifier_group_id
      and mg.restaurant_user_id = modifiers.restaurant_user_id
      and mg.active = true and mg.deleted_at is null
      and rp.active = true and rp.deleted_at is null
  )
);

drop policy if exists "Restaurants manage modifiers" on public.modifiers;
create policy "Restaurants manage modifiers" on public.modifiers
for all to authenticated
using (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'edit_menu'))
with check (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'edit_menu'));

drop policy if exists "Public reads product modifier links" on public.product_modifier_groups;
create policy "Public reads product modifier links" on public.product_modifier_groups
for select to anon, authenticated
using (exists (
  select 1 from public.modifier_groups mg
  join public.restaurant_profiles rp on rp.user_id = mg.restaurant_user_id
  where mg.id = product_modifier_groups.modifier_group_id
    and mg.restaurant_user_id = product_modifier_groups.restaurant_user_id
    and mg.active = true and mg.deleted_at is null
    and rp.active = true and rp.deleted_at is null
));

drop policy if exists "Restaurants manage product modifier links" on public.product_modifier_groups;
create policy "Restaurants manage product modifier links" on public.product_modifier_groups
for all to authenticated
using (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'edit_menu'))
with check (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'edit_menu'));

drop policy if exists "Public reads product availability" on public.product_availability_overrides;
create policy "Public reads product availability" on public.product_availability_overrides
for select to anon, authenticated
using (exists (
  select 1 from public.restaurant_profiles rp
  where rp.user_id = product_availability_overrides.restaurant_user_id
    and rp.active = true and rp.deleted_at is null
));

drop policy if exists "Restaurants manage product availability" on public.product_availability_overrides;
create policy "Restaurants manage product availability" on public.product_availability_overrides
for all to authenticated
using (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'edit_menu'))
with check (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'edit_menu'));

drop policy if exists "Restaurants manage special hours" on public.restaurant_special_hours;
create policy "Restaurants manage special hours" on public.restaurant_special_hours
for all to authenticated
using (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'manage_settings'))
with check (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'manage_settings'));

drop policy if exists "Public reads current promotions" on public.promotions;
create policy "Public reads current promotions" on public.promotions
for select to anon, authenticated
using (
  active = true and deleted_at is null
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
  and exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = promotions.restaurant_user_id
      and rp.active = true and rp.deleted_at is null
  )
);

drop policy if exists "Restaurants manage promotions" on public.promotions;
create policy "Restaurants manage promotions" on public.promotions
for all to authenticated
using (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'manage_promotions'))
with check (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'manage_promotions'));

drop policy if exists "Participants read reviews" on public.reviews;
create policy "Participants read reviews" on public.reviews
for select to authenticated
using (
  customer_user_id = auth.uid()
  or public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'view_reviews')
  or courier_user_id = auth.uid()
  or public.rc_ordera_is_platform_admin(auth.uid())
);

drop policy if exists "Authorized users read support tickets" on public.support_tickets;
create policy "Authorized users read support tickets" on public.support_tickets
for select to authenticated
using (
  created_by_user_id = auth.uid()
  or assigned_to_user_id = auth.uid()
  or (restaurant_user_id is not null and public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'manage_support'))
  or public.rc_ordera_is_platform_admin(auth.uid())
);

drop policy if exists "Authorized users read support messages" on public.support_messages;
create policy "Authorized users read support messages" on public.support_messages
for select to authenticated
using (exists (
  select 1 from public.support_tickets st
  where st.id = support_messages.support_ticket_id
    and (
      st.created_by_user_id = auth.uid()
      or st.assigned_to_user_id = auth.uid()
      or (st.restaurant_user_id is not null and public.rc_ordera_can_manage_restaurant(st.restaurant_user_id, 'manage_support'))
      or public.rc_ordera_is_platform_admin(auth.uid())
    )
));

drop policy if exists "Customers read own loyalty accounts" on public.loyalty_accounts;
create policy "Customers read own loyalty accounts" on public.loyalty_accounts
for select to authenticated
using (
  customer_user_id = auth.uid()
  or public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'manage_loyalty')
  or public.rc_ordera_is_platform_admin(auth.uid())
);

drop policy if exists "Customers read own loyalty transactions" on public.loyalty_transactions;
create policy "Customers read own loyalty transactions" on public.loyalty_transactions
for select to authenticated
using (exists (
  select 1 from public.loyalty_accounts la
  where la.id = loyalty_transactions.loyalty_account_id
    and (
      la.customer_user_id = auth.uid()
      or public.rc_ordera_can_manage_restaurant(la.restaurant_user_id, 'manage_loyalty')
      or public.rc_ordera_is_platform_admin(auth.uid())
    )
));

drop policy if exists "Public reads active rewards" on public.rewards;
create policy "Public reads active rewards" on public.rewards
for select to anon, authenticated
using (active = true);

drop policy if exists "Restaurants manage rewards" on public.rewards;
create policy "Restaurants manage rewards" on public.rewards
for all to authenticated
using (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'manage_loyalty'))
with check (public.rc_ordera_can_manage_restaurant(restaurant_user_id, 'manage_loyalty'));

drop policy if exists "Order participants read payment transactions" on public.payment_transactions;
create policy "Order participants read payment transactions" on public.payment_transactions
for select to authenticated
using (public.rc_ordera_can_access_order(customer_order_id));

drop policy if exists "Order participants read refunds" on public.refund_transactions;
create policy "Order participants read refunds" on public.refund_transactions
for select to authenticated
using (public.rc_ordera_can_access_order(customer_order_id));

drop policy if exists "Couriers read own settlements" on public.courier_settlements;
create policy "Couriers read own settlements" on public.courier_settlements
for select to authenticated
using (courier_user_id = auth.uid() or public.rc_ordera_is_platform_admin(auth.uid()));

create or replace function public.toggle_customer_favorite(
  p_restaurant_user_id uuid,
  p_favorite_type text default 'restaurant',
  p_product_id text default ''
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_type text := lower(trim(coalesce(p_favorite_type, 'restaurant')));
  v_product_id text := trim(coalesce(p_product_id, ''));
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if v_type not in ('restaurant', 'product') then raise exception 'Invalid favorite type'; end if;
  if v_type = 'restaurant' then v_product_id := ''; end if;
  if v_type = 'product' and v_product_id = '' then raise exception 'Product id is required'; end if;
  if not exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = p_restaurant_user_id and rp.active = true and rp.deleted_at is null
  ) then raise exception 'Restaurant is not available'; end if;

  delete from public.customer_favorites cf
  where cf.customer_user_id = v_user_id
    and cf.restaurant_user_id = p_restaurant_user_id
    and cf.favorite_type = v_type
    and cf.product_id = v_product_id;
  if found then return false; end if;

  insert into public.customer_favorites (
    customer_user_id, restaurant_user_id, favorite_type, product_id
  ) values (v_user_id, p_restaurant_user_id, v_type, v_product_id)
  on conflict do nothing;
  return true;
end;
$$;

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
set search_path = pg_catalog, public
as $$
begin
  if p_order_id is null or trim(coalesce(p_public_token, '')) = '' then
    return;
  end if;
  if not exists (
    select 1
    from public.customer_orders co
    where co.id = p_order_id
      and co.public_token = trim(p_public_token)
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

create or replace function public.submit_customer_review(
  p_customer_order_id uuid,
  p_restaurant_rating integer,
  p_food_rating integer,
  p_courier_rating integer,
  p_overall_rating integer,
  p_comment text default ''
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.customer_orders%rowtype;
  v_review_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select co.* into v_order
  from public.customer_orders co
  where co.id = p_customer_order_id and co.customer_user_id = v_user_id;
  if not found then raise exception 'Order not found'; end if;
  if v_order.canonical_status <> 'delivered' and v_order.status <> 'delivered' then
    raise exception 'Only delivered orders can be reviewed';
  end if;
  if p_restaurant_rating not between 1 and 5
     or p_food_rating not between 1 and 5
     or p_overall_rating not between 1 and 5
     or (p_courier_rating is not null and p_courier_rating not between 1 and 5) then
    raise exception 'Ratings must be between 1 and 5';
  end if;

  insert into public.reviews (
    customer_order_id, customer_user_id, restaurant_user_id, courier_user_id,
    restaurant_rating, food_rating, courier_rating, overall_rating, comment
  ) values (
    v_order.id, v_user_id, v_order.user_id, v_order.assigned_courier_user_id,
    p_restaurant_rating, p_food_rating, p_courier_rating,
    p_overall_rating, left(trim(coalesce(p_comment, '')), 2000)
  )
  on conflict (customer_order_id, customer_user_id)
  do update set
    restaurant_rating = excluded.restaurant_rating,
    food_rating = excluded.food_rating,
    courier_rating = excluded.courier_rating,
    overall_rating = excluded.overall_rating,
    comment = excluded.comment,
    updated_at = now()
  returning id into v_review_id;
  return v_review_id;
end;
$$;

create or replace function public.create_support_ticket(
  p_customer_order_id uuid,
  p_category text,
  p_subject text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.customer_orders%rowtype;
  v_actor_role text;
  v_ticket_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if trim(coalesce(p_category, '')) = '' or trim(coalesce(p_subject, '')) = '' then
    raise exception 'Category and subject are required';
  end if;

  if p_customer_order_id is not null then
    select co.* into v_order from public.customer_orders co where co.id = p_customer_order_id;
    if not found or not public.rc_ordera_can_access_order(p_customer_order_id) then
      raise exception 'Order not found';
    end if;
    v_actor_role := public.rc_ordera_actor_role(p_customer_order_id, v_user_id);
  else
    if public.rc_ordera_is_platform_admin(v_user_id) then v_actor_role := 'admin';
    elsif exists (select 1 from public.courier_profiles cp where cp.user_id = v_user_id) then v_actor_role := 'courier';
    elsif exists (select 1 from public.restaurant_profiles rp where rp.user_id = v_user_id) then v_actor_role := 'restaurant';
    else v_actor_role := 'customer'; end if;
  end if;

  insert into public.support_tickets (
    created_by_user_id, actor_role, restaurant_user_id, customer_order_id,
    category, subject, description
  ) values (
    v_user_id,
    case
      when v_actor_role in ('platform_admin', 'admin') then 'admin'
      when v_actor_role in ('platform_courier', 'courier') then 'courier'
      when v_actor_role in ('restaurant_owner', 'restaurant', 'manager', 'cashier', 'kitchen', 'packing', 'dispatch', 'waiter') then 'restaurant'
      else 'customer'
    end,
    case when p_customer_order_id is null then null else v_order.user_id end,
    p_customer_order_id,
    left(trim(p_category), 100),
    left(trim(p_subject), 200),
    left(trim(coalesce(p_description, '')), 4000)
  ) returning id into v_ticket_id;
  return v_ticket_id;
end;
$$;

revoke all on function public.rc_ordera_can_manage_restaurant(uuid, text) from public, anon;
revoke all on function public.toggle_customer_favorite(uuid, text, text) from public, anon;
revoke all on function public.get_customer_order_timeline(uuid, text) from public;
revoke all on function public.submit_customer_review(uuid, integer, integer, integer, integer, text) from public, anon;
revoke all on function public.create_support_ticket(uuid, text, text, text) from public, anon;

grant execute on function public.rc_ordera_can_manage_restaurant(uuid, text) to authenticated;
grant execute on function public.toggle_customer_favorite(uuid, text, text) to authenticated;
grant execute on function public.get_customer_order_timeline(uuid, text) to anon, authenticated;
grant execute on function public.submit_customer_review(uuid, integer, integer, integer, integer, text) to authenticated;
grant execute on function public.create_support_ticket(uuid, text, text, text) to authenticated;

grant select, insert, update on public.customer_addresses to authenticated;
grant select, insert, delete on public.customer_favorites to authenticated;
grant select on public.modifier_groups, public.modifiers, public.product_modifier_groups to anon, authenticated;
grant select on public.product_availability_overrides, public.promotions, public.rewards to anon, authenticated;
grant select on public.restaurant_special_hours to authenticated;
grant insert, update, delete on public.modifier_groups, public.modifiers, public.product_modifier_groups to authenticated;
grant insert, update, delete on public.product_availability_overrides, public.restaurant_special_hours, public.promotions, public.rewards to authenticated;
grant select on public.reviews, public.support_tickets, public.support_messages to authenticated;
grant select on public.loyalty_accounts, public.loyalty_transactions to authenticated;
grant select on public.payment_transactions, public.refund_transactions, public.courier_settlements to authenticated;

-- Las tablas financieras y de puntos no reciben permisos de escritura directos
-- para authenticated. Sus escrituras futuras deben pasar por backend verificado.
revoke insert, update, delete on public.payment_transactions from authenticated;
revoke insert, update, delete on public.refund_transactions from authenticated;
revoke insert, update, delete on public.courier_settlements from authenticated;
revoke insert, update, delete on public.loyalty_accounts from authenticated;
revoke insert, update, delete on public.loyalty_transactions from authenticated;
revoke insert, update, delete on public.reviews from authenticated;
revoke insert, update, delete on public.support_tickets from authenticated;
revoke insert, update, delete on public.support_messages from authenticated;

do $realtime$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_availability_overrides'
    ) then execute 'alter publication supabase_realtime add table public.product_availability_overrides'; end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
    ) then execute 'alter publication supabase_realtime add table public.support_messages'; end if;
  end if;
end;
$realtime$;

do $verify$
begin
  if to_regclass('public.customer_addresses') is null
     or to_regclass('public.customer_favorites') is null
     or to_regclass('public.modifier_groups') is null
     or to_regclass('public.reviews') is null
     or to_regclass('public.support_tickets') is null
     or to_regclass('public.payment_transactions') is null
     or to_regprocedure('public.toggle_customer_favorite(uuid,text,text)') is null
     or to_regprocedure('public.get_customer_order_timeline(uuid,text)') is null then
    raise exception 'V84 no pudo completar sus contratos.';
  end if;
end;
$verify$;

notify pgrst, 'reload schema';

commit;
