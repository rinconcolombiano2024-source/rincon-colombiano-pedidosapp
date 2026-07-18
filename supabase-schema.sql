create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  menu jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_number integer not null,
  business_date date not null,
  order_json jsonb not null,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_date date not null,
  next_ticket integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, business_date)
);

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  default_address jsonb not null default '{}'::jsonb,
  language text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  public_token text not null default encode(gen_random_bytes(16), 'hex'),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'sent', 'delivered', 'cancelled')),
  table_label text not null default '',
  customer_name text not null default '',
  order_type text not null default 'Comer en el punto',
  order_json jsonb not null default '{}'::jsonb,
  total numeric(12, 2) not null default 0,
  restaurant_order_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('customer', 'restaurant')),
  body text not null default '',
  image_data_url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
alter table public.orders enable row level security;
alter table public.ticket_counters enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_messages enable row level security;

drop policy if exists "Users manage own app settings" on public.app_settings;
create policy "Users manage own app settings"
on public.app_settings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Public read app menu settings" on public.app_settings;
create policy "Public read app menu settings"
on public.app_settings
for select
using (true);

drop policy if exists "Users manage own orders" on public.orders;
create policy "Users manage own orders"
on public.orders
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own ticket counters" on public.ticket_counters;
create policy "Users manage own ticket counters"
on public.ticket_counters
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Customers manage own profile" on public.customer_profiles;
create policy "Customers manage own profile"
on public.customer_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Customers create pending customer orders" on public.customer_orders;
create policy "Customers create pending customer orders"
on public.customer_orders
for insert
to authenticated
with check (status = 'pending' and auth.uid() = customer_user_id);

drop policy if exists "Authenticated customers create own pending customer orders" on public.customer_orders;
create policy "Authenticated customers create own pending customer orders"
on public.customer_orders
for insert
to authenticated
with check (status = 'pending' and auth.uid() = customer_user_id);

drop policy if exists "Authenticated customers read own customer orders" on public.customer_orders;
create policy "Authenticated customers read own customer orders"
on public.customer_orders
for select
to authenticated
using (auth.uid() = customer_user_id);

drop policy if exists "Users manage own customer orders" on public.customer_orders;
create policy "Users manage own customer orders"
on public.customer_orders
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own customer order messages" on public.customer_order_messages;
create policy "Users manage own customer order messages"
on public.customer_order_messages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select on public.app_settings to anon, authenticated;
grant select, insert, update, delete on public.customer_profiles to authenticated;
revoke insert on public.customer_orders from anon;
grant select, insert, update, delete on public.customer_orders to authenticated;
grant select, insert, update, delete on public.customer_order_messages to authenticated;

alter table public.customer_orders
add column if not exists public_token text;

alter table public.customer_orders
add column if not exists customer_user_id uuid references auth.users(id) on delete set null;

update public.customer_orders
set public_token = encode(gen_random_bytes(16), 'hex')
where public_token is null;

alter table public.customer_orders
alter column public_token set default encode(gen_random_bytes(16), 'hex');

alter table public.customer_orders
alter column public_token set not null;

alter table public.customer_orders
drop constraint if exists customer_orders_status_check;

alter table public.customer_orders
add constraint customer_orders_status_check
check (status in ('pending', 'accepted', 'sent', 'delivered', 'cancelled'));

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
set search_path = public
as $$
begin
  if p_public_token is null or length(trim(p_public_token)) < 8 then
    raise exception 'Invalid public token';
  end if;

  return query
  insert into public.customer_orders (
    id,
    public_token,
    user_id,
    customer_user_id,
    status,
    table_label,
    customer_name,
    order_type,
    order_json,
    total,
    created_at,
    updated_at
  )
  values (
    coalesce(p_id, gen_random_uuid()),
    p_public_token,
    p_user_id,
    auth.uid(),
    'pending',
    coalesce(p_table_label, ''),
    coalesce(p_customer_name, ''),
    coalesce(p_order_type, 'Comer en el punto'),
    coalesce(p_order_json, '{}'::jsonb),
    coalesce(p_total, 0),
    now(),
    now()
  )
  returning public.customer_orders.id, public.customer_orders.public_token;
end;
$$;

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
    and co.public_token = p_public_token
  limit 1;
$$;

revoke execute on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) from anon;
grant execute on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) to authenticated;
grant execute on function public.get_customer_order_status(uuid, text) to anon, authenticated;

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
    co.public_token,
    co.user_id as restaurant_user_id,
    coalesce(nullif(s.settings->>'businessName', ''), 'Restaurante') as restaurant_name,
    co.status,
    co.table_label,
    co.customer_name,
    co.order_type,
    co.order_json,
    co.total,
    co.restaurant_order_id,
    o.ticket_number,
    co.created_at,
    co.updated_at
  from public.customer_orders co
  left join public.orders o on o.id = co.restaurant_order_id
  left join public.app_settings s on s.user_id = co.user_id
  where co.customer_user_id = auth.uid()
  order by co.created_at desc
  limit 100;
$$;

grant execute on function public.get_customer_order_history() to authenticated;

create index if not exists customer_order_messages_order_created_idx
on public.customer_order_messages (order_id, created_at);

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
    and co.public_token = p_public_token;

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

create or replace function public.create_restaurant_message(
  p_order_id uuid,
  p_body text,
  p_image_data_url text
)
returns table(id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := left(trim(coalesce(p_body, '')), 1200);
  v_image text := coalesce(p_image_data_url, '');
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.customer_orders co
    where co.id = p_order_id
      and co.user_id = v_user_id
  ) then
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
  values (p_order_id, v_user_id, 'restaurant', v_body, v_image)
  returning public.customer_order_messages.id;
end;
$$;

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
    and co.public_token = p_public_token
  order by msg.created_at asc;
$$;

create or replace function public.get_restaurant_order_messages(
  p_order_id uuid
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
    and co.user_id = auth.uid()
  order by msg.created_at asc;
$$;

grant execute on function public.create_customer_message(uuid, text, text, text) to anon, authenticated;
grant execute on function public.create_restaurant_message(uuid, text, text) to authenticated;
grant execute on function public.get_customer_order_messages(uuid, text) to anon, authenticated;
grant execute on function public.get_restaurant_order_messages(uuid) to authenticated;

create or replace function public.claim_next_ticket(p_business_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.ticket_counters (user_id, business_date, next_ticket)
  values (v_user_id, p_business_date, 1)
  on conflict (user_id, business_date) do nothing;

  select next_ticket
    into v_ticket
  from public.ticket_counters
  where user_id = v_user_id
    and business_date = p_business_date
  for update;

  update public.ticket_counters
  set next_ticket = v_ticket + 1,
      updated_at = now()
  where user_id = v_user_id
    and business_date = p_business_date;

  return v_ticket;
end;
$$;

create or replace function public.set_next_ticket(p_business_date date, p_next_ticket integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_next_ticket < 1 then
    raise exception 'Ticket must be greater than zero';
  end if;

  insert into public.ticket_counters (user_id, business_date, next_ticket)
  values (v_user_id, p_business_date, p_next_ticket)
  on conflict (user_id, business_date)
  do update set next_ticket = excluded.next_ticket,
                updated_at = now();
end;
$$;
