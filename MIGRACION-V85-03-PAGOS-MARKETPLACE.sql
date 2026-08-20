-- RC ORDERA V85.03
-- Libro mayor y confirmaciones para pagos marketplace.
-- No activa cobros por si sola: requiere desplegar Edge Functions y configurar secretos.
-- Incremental e idempotente. No elimina ni modifica importes historicos.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.customer_orders') is null
     or to_regclass('public.payment_transactions') is null
     or to_regclass('public.delivery_assignments') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.courier_profiles') is null then
    raise exception 'Falta la estructura V82/V84 necesaria para pagos marketplace.';
  end if;
end;
$$;

alter table public.payment_transactions
  add column if not exists checkout_url text not null default '',
  add column if not exists provider_session_id text not null default '',
  add column if not exists transfer_group text not null default '',
  add column if not exists expires_at timestamptz null;

create unique index if not exists payment_transactions_provider_session_idx
  on public.payment_transactions (provider, provider_session_id)
  where provider_session_id <> '';

create table if not exists public.marketplace_finance_config (
  id boolean primary key default true check (id = true),
  restaurant_fee_bps integer not null default 500 check (restaurant_fee_bps between 0 and 10000),
  courier_fee_bps integer not null default 10 check (courier_fee_bps between 0 and 10000),
  settlement_currency_policy text not null default 'restaurant_currency',
  updated_at timestamptz not null default now()
);

insert into public.marketplace_finance_config (id, restaurant_fee_bps, courier_fee_bps)
values (true, 500, 10)
on conflict (id) do update set
  restaurant_fee_bps = excluded.restaurant_fee_bps,
  courier_fee_bps = excluded.courier_fee_bps,
  updated_at = now();

create table if not exists public.marketplace_provider_availability (
  country_code text primary key check (country_code = upper(country_code)),
  provider text not null,
  online_payments_enabled boolean not null default false,
  marketplace_split_enabled boolean not null default false,
  public_message text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.marketplace_provider_availability (
  country_code, provider, online_payments_enabled, marketplace_split_enabled, public_message
) values
  ('PL', 'stripe_connect', true, true, 'Disponible cuando el restaurante complete Stripe Connect.'),
  ('CO', 'mercado_pago', false, false, 'Pendiente de aprobacion comercial para pagos divididos 1:N en Colombia.')
on conflict (country_code) do update set
  provider = excluded.provider,
  online_payments_enabled = excluded.online_payments_enabled,
  marketplace_split_enabled = excluded.marketplace_split_enabled,
  public_message = excluded.public_message,
  updated_at = now();

create table if not exists public.marketplace_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  account_type text not null check (account_type in ('restaurant', 'courier')),
  provider text not null,
  country_code text not null,
  currency text not null,
  provider_account_id text not null default '',
  onboarding_status text not null default 'not_started' check (
    onboarding_status in ('not_started', 'pending', 'restricted', 'complete', 'disabled')
  ),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, account_type, provider)
);

create unique index if not exists marketplace_accounts_provider_account_idx
  on public.marketplace_accounts (provider, provider_account_id)
  where provider_account_id <> '';

create table if not exists public.marketplace_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null unique references public.payment_transactions(id) on delete restrict,
  customer_order_id uuid not null unique references public.customer_orders(id) on delete restrict,
  restaurant_user_id uuid not null references auth.users(id) on delete restrict,
  courier_user_id uuid null references auth.users(id) on delete restrict,
  currency text not null,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  restaurant_gross_amount numeric(12,2) not null check (restaurant_gross_amount >= 0),
  delivery_gross_amount numeric(12,2) not null check (delivery_gross_amount >= 0),
  restaurant_fee_bps integer not null,
  courier_fee_bps integer not null,
  restaurant_fee_amount numeric(12,2) not null check (restaurant_fee_amount >= 0),
  courier_fee_amount numeric(12,2) not null check (courier_fee_amount >= 0),
  restaurant_net_amount numeric(12,2) not null check (restaurant_net_amount >= 0),
  courier_net_amount numeric(12,2) not null check (courier_net_amount >= 0),
  platform_amount numeric(12,2) not null check (platform_amount >= 0),
  status text not null default 'funds_held' check (
    status in ('funds_held', 'partially_released', 'eligible', 'transferring', 'settled', 'failed', 'refunded')
  ),
  restaurant_release_eligible_at timestamptz null,
  courier_release_eligible_at timestamptz null,
  restaurant_transfer_id text not null default '',
  courier_transfer_id text not null default '',
  restaurant_transferred_at timestamptz null,
  courier_transferred_at timestamptz null,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (round(restaurant_net_amount + courier_net_amount + platform_amount, 2) = round(gross_amount, 2))
);

create index if not exists marketplace_allocations_release_idx
  on public.marketplace_payment_allocations (status, restaurant_release_eligible_at, courier_release_eligible_at);

create table if not exists public.delivery_completion_confirmations (
  customer_order_id uuid primary key references public.customer_orders(id) on delete restrict,
  delivery_assignment_id uuid not null references public.delivery_assignments(id) on delete restrict,
  customer_user_id uuid null references auth.users(id) on delete set null,
  courier_user_id uuid not null references auth.users(id) on delete restrict,
  courier_confirmed_at timestamptz null,
  customer_confirmed_at timestamptz null,
  completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload_sha256 text not null default '',
  processing_status text not null default 'received' check (
    processing_status in ('received', 'processed', 'ignored', 'failed')
  ),
  error_message text not null default '',
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  unique (provider, provider_event_id)
);

alter table public.marketplace_finance_config enable row level security;
alter table public.marketplace_provider_availability enable row level security;
alter table public.marketplace_accounts enable row level security;
alter table public.marketplace_payment_allocations enable row level security;
alter table public.delivery_completion_confirmations enable row level security;
alter table public.payment_provider_events enable row level security;

drop policy if exists "Public reads payment provider availability" on public.marketplace_provider_availability;
create policy "Public reads payment provider availability"
on public.marketplace_provider_availability for select to anon, authenticated using (true);

drop policy if exists "Owners read own marketplace accounts" on public.marketplace_accounts;
create policy "Owners read own marketplace accounts"
on public.marketplace_accounts for select to authenticated
using (owner_user_id = auth.uid() or public.rc_ordera_is_platform_admin(auth.uid()));

drop policy if exists "Participants read payment allocations" on public.marketplace_payment_allocations;
create policy "Participants read payment allocations"
on public.marketplace_payment_allocations for select to authenticated
using (
  restaurant_user_id = auth.uid() or courier_user_id = auth.uid()
  or exists (
    select 1 from public.customer_orders co
    where co.id = marketplace_payment_allocations.customer_order_id
      and co.customer_user_id = auth.uid()
  )
  or public.rc_ordera_is_platform_admin(auth.uid())
);

drop policy if exists "Participants read delivery confirmations" on public.delivery_completion_confirmations;
create policy "Participants read delivery confirmations"
on public.delivery_completion_confirmations for select to authenticated
using (
  customer_user_id = auth.uid() or courier_user_id = auth.uid()
  or exists (
    select 1 from public.customer_orders co
    where co.id = delivery_completion_confirmations.customer_order_id and co.user_id = auth.uid()
  )
  or public.rc_ordera_is_platform_admin(auth.uid())
);

create or replace function public.rc_ordera_calculate_marketplace_allocation(
  p_payment_transaction_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment public.payment_transactions%rowtype;
  v_order public.customer_orders%rowtype;
  v_config public.marketplace_finance_config%rowtype;
  v_courier_id uuid;
  v_restaurant_gross numeric(12,2);
  v_delivery_gross numeric(12,2);
  v_restaurant_fee numeric(12,2);
  v_courier_fee numeric(12,2);
  v_restaurant_net numeric(12,2);
  v_courier_net numeric(12,2);
  v_platform numeric(12,2);
  v_id uuid;
begin
  select pt.* into v_payment from public.payment_transactions pt where pt.id = p_payment_transaction_id;
  if not found or v_payment.status <> 'paid' then raise exception 'Payment is not settled'; end if;
  select co.* into v_order from public.customer_orders co where co.id = v_payment.customer_order_id;
  if not found then raise exception 'Order was not found'; end if;
  select cfg.* into v_config from public.marketplace_finance_config cfg where cfg.id = true;

  select da.courier_user_id into v_courier_id
  from public.delivery_assignments da
  where da.customer_order_id = v_order.id and da.status in (
    'accepted', 'arrived_restaurant', 'picked_up', 'arrived_customer', 'delivered'
  ) order by da.updated_at desc limit 1;

  v_restaurant_gross := round(greatest(v_order.subtotal - v_order.discount_amount, 0), 2);
  v_delivery_gross := round(greatest(v_order.final_delivery_fee, 0), 2);
  v_restaurant_fee := round(v_restaurant_gross * v_config.restaurant_fee_bps / 10000.0, 2);
  v_courier_fee := round(v_delivery_gross * v_config.courier_fee_bps / 10000.0, 2);
  v_restaurant_net := greatest(v_restaurant_gross - v_restaurant_fee, 0);
  v_courier_net := greatest(v_delivery_gross - v_courier_fee, 0);
  v_platform := round(v_payment.amount - v_restaurant_net - v_courier_net, 2);
  if v_platform < 0 then raise exception 'Allocation does not reconcile'; end if;

  insert into public.marketplace_payment_allocations (
    payment_transaction_id, customer_order_id, restaurant_user_id, courier_user_id,
    currency, gross_amount, restaurant_gross_amount, delivery_gross_amount,
    restaurant_fee_bps, courier_fee_bps, restaurant_fee_amount, courier_fee_amount,
    restaurant_net_amount, courier_net_amount, platform_amount,
    restaurant_release_eligible_at, courier_release_eligible_at, updated_at
  ) values (
    v_payment.id, v_order.id, v_order.user_id, v_courier_id,
    v_payment.currency, v_payment.amount, v_restaurant_gross, v_delivery_gross,
    v_config.restaurant_fee_bps, v_config.courier_fee_bps, v_restaurant_fee, v_courier_fee,
    v_restaurant_net, v_courier_net, v_platform,
    case when v_order.status = 'delivered' then now() else null end,
    null, now()
  )
  on conflict (payment_transaction_id) do update set
    courier_user_id = coalesce(excluded.courier_user_id, marketplace_payment_allocations.courier_user_id),
    restaurant_release_eligible_at = coalesce(
      marketplace_payment_allocations.restaurant_release_eligible_at,
      excluded.restaurant_release_eligible_at
    ),
    updated_at = now()
  returning marketplace_payment_allocations.id into v_id;
  return v_id;
end;
$$;

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
set search_path = pg_catalog, public
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
      or (length(trim(coalesce(p_public_token, ''))) >= 8 and v_order.public_token = trim(p_public_token))
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
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.customer_orders co
    where co.id = p_customer_order_id and (
      co.user_id = auth.uid() or co.customer_user_id = auth.uid()
      or (length(trim(coalesce(p_public_token, ''))) >= 8 and co.public_token = trim(p_public_token))
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

create or replace function public.rc_ordera_refresh_restaurant_release_eligibility()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'delivered' and old.status is distinct from new.status then
    update public.marketplace_payment_allocations a
    set restaurant_release_eligible_at = coalesce(a.restaurant_release_eligible_at, now()),
        status = case when a.courier_release_eligible_at is not null then 'eligible' else a.status end,
        updated_at = now()
    where a.customer_order_id = new.id and a.status not in ('settled', 'refunded');
  end if;
  return new;
end;
$$;

drop trigger if exists rc_ordera_restaurant_release_eligibility_trigger on public.customer_orders;
-- La elegibilidad del restaurante se confirma exclusivamente mediante
-- marketplace-release-order. Un cambio realizado por el colaborador no puede
-- liberar por si solo el dinero del restaurante.

revoke all on table public.marketplace_finance_config from public, anon, authenticated;
revoke insert, update, delete on table public.marketplace_provider_availability from anon, authenticated;
revoke insert, update, delete on table public.marketplace_accounts from anon, authenticated;
revoke insert, update, delete on table public.marketplace_payment_allocations from anon, authenticated;
revoke insert, update, delete on table public.delivery_completion_confirmations from anon, authenticated;
revoke all on table public.payment_provider_events from public, anon, authenticated;

revoke all on function public.rc_ordera_calculate_marketplace_allocation(uuid) from public, anon, authenticated;
revoke all on function public.record_delivery_completion_confirmation(uuid, text, text) from public;
revoke all on function public.get_order_marketplace_payment_state(uuid, text) from public;
revoke all on function public.rc_ordera_refresh_restaurant_release_eligibility() from public, anon, authenticated;
grant execute on function public.rc_ordera_calculate_marketplace_allocation(uuid) to service_role;
grant execute on function public.record_delivery_completion_confirmation(uuid, text, text) to anon, authenticated;
grant execute on function public.get_order_marketplace_payment_state(uuid, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
