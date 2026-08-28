-- RC ORDERA V82
-- Estabilidad del nucleo: disponibilidad persistente, pedidos seguros, auditoria,
-- historial de estados, Push y concurrencia de entregas.
-- Incremental e idempotente. No elimina tablas, usuarios, pedidos ni menus.

begin;

do $preflight$
begin
  if to_regclass('public.customer_orders') is null
     or to_regclass('public.app_settings') is null
     or to_regclass('public.restaurant_profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.courier_profiles') is null
     or to_regclass('public.courier_live_locations') is null
     or to_regclass('public.delivery_assignments') is null then
    raise exception 'Falta la estructura base de RC ORDERA. Ejecuta primero las migraciones hasta V81.';
  end if;
end;
$preflight$;

alter table public.customer_orders
  add column if not exists canonical_status text not null default 'created',
  add column if not exists idempotency_key text null,
  add column if not exists prep_time_minutes integer null,
  add column if not exists estimated_ready_at timestamptz null,
  add column if not exists actual_ready_at timestamptz null,
  add column if not exists estimated_pickup_at timestamptz null,
  add column if not exists estimated_delivery_at timestamptz null,
  add column if not exists currency text not null default '',
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists base_delivery_fee numeric(12, 2) not null default 0,
  add column if not exists distance_fee numeric(12, 2) not null default 0,
  add column if not exists operational_adjustment numeric(12, 2) not null default 0,
  add column if not exists platform_adjustment numeric(12, 2) not null default 0,
  add column if not exists final_delivery_fee numeric(12, 2) not null default 0,
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists tip_amount numeric(12, 2) not null default 0,
  add column if not exists tip_currency text not null default '',
  add column if not exists tip_status text not null default 'not_applicable',
  add column if not exists payment_method text not null default '',
  add column if not exists payment_provider text not null default '',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists provider_reference text not null default '',
  add column if not exists payment_amount numeric(12, 2) not null default 0,
  add column if not exists payment_currency text not null default '',
  add column if not exists paid_at timestamptz null,
  add column if not exists refunded_at timestamptz null,
  add column if not exists cancelled_by uuid null references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text not null default '',
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancellation_fee numeric(12, 2) not null default 0;

alter table public.delivery_assignments
  add column if not exists score numeric(12, 4) null,
  add column if not exists score_reason jsonb not null default '{}'::jsonb,
  add column if not exists estimated_pickup_at timestamptz null,
  add column if not exists estimated_delivery_at timestamptz null,
  add column if not exists proof_type text not null default '',
  add column if not exists proof_url text not null default '',
  add column if not exists delivery_pin_hash text not null default '',
  add column if not exists delivery_pin_verified boolean not null default false,
  add column if not exists delivered_lat numeric(10, 7) null,
  add column if not exists delivered_lng numeric(10, 7) null,
  add column if not exists delivered_at timestamptz null,
  add column if not exists distance_total_km numeric(10, 3) not null default 0,
  add column if not exists courier_earning numeric(12, 2) not null default 0,
  add column if not exists courier_earning_currency text not null default '';

alter table public.courier_profiles
  add column if not exists max_active_deliveries integer not null default 1,
  add column if not exists max_batch_detour_km numeric(8, 2) not null default 0,
  add column if not exists max_batch_delay_minutes integer not null default 0;

create unique index if not exists customer_orders_restaurant_idempotency_idx
  on public.customer_orders (user_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create index if not exists customer_orders_canonical_created_idx
  on public.customer_orders (user_id, canonical_status, created_at desc);

create index if not exists delivery_assignments_courier_active_idx
  on public.delivery_assignments (courier_user_id, status, updated_at desc);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders(id) on delete restrict,
  previous_status text null,
  new_status text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text not null default 'system',
  source text not null default 'database',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_order_created_idx
  on public.order_status_history (customer_order_id, created_at asc);

create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text not null default 'system',
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  restaurant_user_id uuid null references auth.users(id) on delete set null,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_logs_entity_created_idx
  on public.platform_audit_logs (entity_type, entity_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null default '',
  body text not null default '',
  reference_type text not null default '',
  reference_id uuid null,
  channels jsonb not null default '["in_app"]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists notifications_recipient_reference_unique_idx
  on public.notifications (recipient_user_id, notification_type, reference_type, reference_id)
  where reference_id is not null;

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;

create table if not exists public.courier_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  user_agent text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists courier_push_subscriptions_active_user_idx
  on public.courier_push_subscriptions (user_id, active);

alter table public.order_status_history enable row level security;
alter table public.platform_audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.courier_push_subscriptions enable row level security;

create or replace function public.rc_ordera_is_platform_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_user_id is not null and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'platform_admin'
      and ur.scope_type = 'platform'
      and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
      and ur.status = 'active'
  );
$$;

create or replace function public.rc_ordera_actor_role(p_order_id uuid, p_actor_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.customer_orders%rowtype;
  v_station text;
begin
  if p_actor_user_id is null then return 'system'; end if;
  if public.rc_ordera_is_platform_admin(p_actor_user_id) then return 'platform_admin'; end if;

  select co.* into v_order from public.customer_orders co where co.id = p_order_id;
  if not found then return 'authenticated'; end if;
  if v_order.customer_user_id = p_actor_user_id then return 'customer'; end if;
  if v_order.assigned_courier_user_id = p_actor_user_id then return 'platform_courier'; end if;
  if v_order.user_id = p_actor_user_id then return 'restaurant_owner'; end if;

  select m.station into v_station
  from public.restaurant_staff_memberships m
  where m.restaurant_user_id = v_order.user_id
    and m.member_user_id = p_actor_user_id
    and m.active = true
  order by m.updated_at desc
  limit 1;

  return coalesce(nullif(v_station, ''), 'authenticated');
end;
$$;

create or replace function public.rc_ordera_derive_order_status(
  p_status text,
  p_station_status text,
  p_courier_status text
)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when p_status = 'cancelled' or p_station_status = 'cancelled' or p_courier_status = 'cancelled' then 'cancelled'
    when p_status = 'delivered' or p_station_status = 'completed' or p_courier_status = 'delivered' then 'delivered'
    when p_courier_status = 'arrived_customer' then 'courier_arrived_customer'
    when p_courier_status = 'picked_up' then 'on_the_way'
    when p_courier_status = 'arrived_restaurant' then 'courier_arrived_restaurant'
    when p_courier_status = 'accepted' then 'courier_accepted'
    when p_courier_status = 'offered' then 'courier_offered'
    when p_station_status = 'dispatched' or p_status = 'sent' then 'on_the_way'
    when p_station_status = 'packed' then 'ready_for_pickup'
    when p_station_status = 'ready' then 'ready_for_pickup'
    when p_station_status = 'preparing' then 'preparing'
    when p_status = 'accepted' then 'accepted'
    when p_status = 'pending' then 'submitted'
    else 'created'
  end;
$$;

update public.customer_orders co
set canonical_status = public.rc_ordera_derive_order_status(co.status, co.station_status, co.courier_assignment_status),
    idempotency_key = coalesce(nullif(co.idempotency_key, ''), co.id::text)
where co.canonical_status is distinct from public.rc_ordera_derive_order_status(co.status, co.station_status, co.courier_assignment_status)
   or co.idempotency_key is null
   or co.idempotency_key = '';

alter table public.customer_orders
  drop constraint if exists customer_orders_canonical_status_check;

alter table public.customer_orders
  add constraint customer_orders_canonical_status_check check (
    canonical_status in (
      'created', 'submitted', 'restaurant_review', 'accepted', 'rejected',
      'preparing', 'ready_for_pickup', 'courier_searching', 'courier_offered',
      'courier_accepted', 'courier_arrived_restaurant', 'picked_up', 'on_the_way',
      'courier_arrived_customer', 'delivered', 'cancelled', 'failed', 'refunded'
    )
  );

create or replace function public.rc_ordera_prepare_order_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.canonical_status := public.rc_ordera_derive_order_status(
    new.status,
    new.station_status,
    new.courier_assignment_status
  );
  if new.idempotency_key is null or trim(new.idempotency_key) = '' then
    new.idempotency_key := new.id::text;
  end if;
  return new;
end;
$$;

create or replace function public.rc_ordera_record_order_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_previous text := case when tg_op = 'INSERT' then null else old.canonical_status end;
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' or v_previous is distinct from new.canonical_status then
    insert into public.order_status_history (
      customer_order_id, previous_status, new_status, actor_user_id,
      actor_role, source, metadata
    ) values (
      new.id,
      v_previous,
      new.canonical_status,
      v_actor,
      public.rc_ordera_actor_role(new.id, v_actor),
      case when v_actor is null then 'database' else 'application' end,
      jsonb_build_object(
        'legacy_status', new.status,
        'station_status', new.station_status,
        'courier_status', new.courier_assignment_status
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists rc_ordera_prepare_order_status_trigger on public.customer_orders;
create trigger rc_ordera_prepare_order_status_trigger
before insert or update of status, station_status, courier_assignment_status, canonical_status, idempotency_key
on public.customer_orders
for each row execute function public.rc_ordera_prepare_order_status();

drop trigger if exists rc_ordera_record_order_status_trigger on public.customer_orders;
create trigger rc_ordera_record_order_status_trigger
after insert or update of canonical_status
on public.customer_orders
for each row execute function public.rc_ordera_record_order_status();

create or replace function public.rc_ordera_can_access_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and (
    public.rc_ordera_is_platform_admin(auth.uid())
    or exists (
      select 1 from public.customer_orders co
      where co.id = p_order_id
        and (
          co.user_id = auth.uid()
          or co.customer_user_id = auth.uid()
          or co.assigned_courier_user_id = auth.uid()
          or exists (
            select 1 from public.restaurant_staff_memberships m
            where m.restaurant_user_id = co.user_id
              and m.member_user_id = auth.uid()
              and m.active = true
          )
        )
    )
  );
$$;

drop policy if exists "Authorized users read order status history" on public.order_status_history;
create policy "Authorized users read order status history"
on public.order_status_history for select to authenticated
using (public.rc_ordera_can_access_order(customer_order_id));

drop policy if exists "Platform admins read audit logs" on public.platform_audit_logs;
create policy "Platform admins read audit logs"
on public.platform_audit_logs for select to authenticated
using (public.rc_ordera_is_platform_admin(auth.uid()));

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
on public.notifications for select to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
on public.notifications for update to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

drop policy if exists "Couriers manage own push subscriptions" on public.courier_push_subscriptions;
create policy "Couriers manage own push subscriptions"
on public.courier_push_subscriptions for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.courier_profiles cp
    join public.user_roles ur
      on ur.user_id = cp.user_id
     and ur.role = 'platform_courier'
     and ur.scope_type = 'platform'
     and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
     and ur.status = 'active'
    where cp.user_id = auth.uid() and cp.status = 'approved'
  )
);

create or replace function public.set_courier_availability(p_available boolean)
returns table(available boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  if coalesce(p_available, false) then
    if not exists (
      select 1
      from public.courier_profiles cp
      join public.user_roles ur
        on ur.user_id = cp.user_id
       and ur.role = 'platform_courier'
       and ur.scope_type = 'platform'
       and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
       and ur.status = 'active'
      where cp.user_id = v_user_id and cp.status = 'approved'
    ) then raise exception 'Courier profile is not approved'; end if;

    update public.courier_live_locations cl
    set available = true, updated_at = now()
    where cl.user_id = v_user_id
      and cl.lat between -90 and 90
      and cl.lng between -180 and 180;
    if not found then raise exception 'Share a valid location before going online'; end if;
  else
    update public.courier_live_locations cl
    set available = false, updated_at = now()
    where cl.user_id = v_user_id;
  end if;

  return query
  select coalesce(cl.available, false), coalesce(cl.updated_at, now())
  from (select 1) seed
  left join public.courier_live_locations cl on cl.user_id = v_user_id;
end;
$$;

-- GPS writes update position but never disconnect an existing online courier.
-- Only set_courier_availability(false), explicit sign-out or admin review can do that.
create or replace function public.upsert_courier_live_location(
  p_available boolean,
  p_lat numeric,
  p_lng numeric,
  p_accuracy_m integer default 0
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_country_code text;
  v_city text;
  v_region text;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid location';
  end if;

  select upper(trim(coalesce(cp.country_code, ''))), trim(coalesce(cp.city, '')), trim(coalesce(cp.region, ''))
  into v_country_code, v_city, v_region
  from public.courier_profiles cp
  join public.user_roles ur
    on ur.user_id = cp.user_id
   and ur.role = 'platform_courier'
   and ur.scope_type = 'platform'
   and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
   and ur.status = 'active'
  where cp.user_id = v_user_id and cp.status = 'approved';

  if not found then raise exception 'Courier profile is not approved'; end if;

  insert into public.courier_live_locations (
    user_id, available, lat, lng, accuracy_m, country_code, city, region, updated_at
  ) values (
    v_user_id, coalesce(p_available, false), p_lat, p_lng,
    greatest(coalesce(p_accuracy_m, 0), 0), v_country_code, v_city, v_region, now()
  )
  on conflict on constraint courier_live_locations_pkey
  do update set
    available = case
      when excluded.available is true then true
      else public.courier_live_locations.available
    end,
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy_m = excluded.accuracy_m,
    country_code = excluded.country_code,
    city = excluded.city,
    region = excluded.region,
    updated_at = now();
end;
$$;

create or replace function public.review_courier_profile(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_role_status text;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.rc_ordera_is_platform_admin(v_admin_id) then
    raise exception using errcode = '42501', message = 'Not authorized to review couriers';
  end if;
  if p_user_id is null then raise exception using errcode = '22023', message = 'Courier user id is required'; end if;
  if v_status not in ('approved', 'rejected', 'suspended', 'inactive', 'pending_review') then
    raise exception using errcode = '22023', message = 'Invalid courier status';
  end if;

  select to_jsonb(cp) into v_before from public.courier_profiles cp where cp.user_id = p_user_id for update;
  if v_before is null then raise exception using errcode = 'P0002', message = 'Courier profile not found'; end if;

  update public.courier_profiles cp
  set status = v_status, reviewed_at = now(), reviewed_by_user_id = v_admin_id, updated_at = now()
  where cp.user_id = p_user_id;

  v_role_status := case v_status
    when 'approved' then 'active'
    when 'rejected' then 'revoked'
    when 'suspended' then 'suspended'
    when 'inactive' then 'inactive'
    else 'pending_review'
  end;

  insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
  values (p_user_id, 'platform_courier', 'platform', '00000000-0000-0000-0000-000000000000'::uuid, v_role_status, now())
  on conflict on constraint user_roles_pkey
  do update set status = excluded.status, updated_at = now();

  if v_status <> 'approved' then
    update public.courier_live_locations cl
    set available = false, updated_at = now()
    where cl.user_id = p_user_id;
  end if;

  select to_jsonb(cp) into v_after from public.courier_profiles cp where cp.user_id = p_user_id;
  insert into public.platform_audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, before_data, after_data
  ) values (
    v_admin_id, 'platform_admin', 'review_courier_' || v_status,
    'courier_profile', p_user_id, coalesce(v_before, '{}'::jsonb), coalesce(v_after, '{}'::jsonb)
  );
end;
$$;

create or replace function public.update_delivery_assignment_status(
  p_assignment_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text := lower(trim(coalesce(p_status, '')));
  v_customer_order_id uuid;
  v_assignment public.delivery_assignments%rowtype;
  v_order public.customer_orders%rowtype;
  v_is_courier boolean;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if v_status not in ('accepted', 'rejected', 'arrived_restaurant', 'picked_up', 'arrived_customer', 'delivered', 'cancelled') then
    raise exception 'Invalid assignment status';
  end if;

  select da.customer_order_id into v_customer_order_id
  from public.delivery_assignments da where da.id = p_assignment_id;
  if v_customer_order_id is null then raise exception 'Assignment not found'; end if;

  select co.* into v_order
  from public.customer_orders co
  where co.id = v_customer_order_id
  for update;

  select da.* into v_assignment
  from public.delivery_assignments da
  where da.id = p_assignment_id
    and (da.courier_user_id = v_user_id or da.restaurant_user_id = v_user_id)
  for update;
  if not found then raise exception 'Assignment not found'; end if;

  v_is_courier := v_user_id = v_assignment.courier_user_id;
  if v_assignment.status = v_status then return; end if;
  if v_assignment.status in ('delivered', 'cancelled', 'rejected', 'expired') then
    raise exception 'Assignment transition is not allowed';
  end if;
  if v_is_courier and v_status = 'cancelled' then
    raise exception 'Courier must report an incident; courier cannot cancel the order';
  end if;

  if not v_is_courier and v_status = 'cancelled' then
    update public.delivery_assignments da set status = 'cancelled', updated_at = now() where da.id = v_assignment.id;
    update public.customer_orders co
    set status = 'cancelled', courier_assignment_status = 'cancelled', assigned_courier_user_id = null,
        cancelled_by = v_user_id, cancelled_at = now(), updated_at = now()
    where co.id = v_assignment.customer_order_id;
    return;
  end if;

  if not v_is_courier then raise exception 'Only the assigned courier can advance delivery stages'; end if;

  if v_assignment.status = 'offered' and v_assignment.offer_expires_at <= now() then
    raise exception 'Offer expired';
  end if;

  if v_status = 'accepted' then
    if v_assignment.status <> 'offered'
       or v_order.assigned_courier_user_id is distinct from v_assignment.courier_user_id
       or v_order.courier_assignment_status <> 'offered'
       or not exists (
         select 1 from public.courier_live_locations cl
         where cl.user_id = v_assignment.courier_user_id and cl.available = true
       ) then
      raise exception 'Offer is no longer available';
    end if;

    update public.delivery_assignments da
    set status = 'accepted', updated_at = now()
    where da.id = v_assignment.id and da.status = 'offered' and da.offer_expires_at > now();
    if not found then raise exception 'Offer is no longer available'; end if;

    update public.delivery_assignments da
    set status = 'expired', updated_at = now()
    where da.customer_order_id = v_assignment.customer_order_id
      and da.id <> v_assignment.id and da.status = 'offered';

    update public.customer_orders co
    set assigned_courier_user_id = v_assignment.courier_user_id,
        courier_assignment_status = 'accepted', status = 'accepted', updated_at = now()
    where co.id = v_assignment.customer_order_id;
    return;
  end if;

  if v_status = 'rejected' then
    if v_assignment.status <> 'offered' then raise exception 'Offer is no longer available'; end if;
    update public.delivery_assignments da set status = 'rejected', updated_at = now() where da.id = v_assignment.id;
    update public.customer_orders co
    set assigned_courier_user_id = null, courier_assignment_status = 'rejected', updated_at = now()
    where co.id = v_assignment.customer_order_id
      and co.assigned_courier_user_id = v_assignment.courier_user_id;
    perform 1 from public.rc_ordera_offer_next_courier(
      v_assignment.customer_order_id, v_assignment.restaurant_user_id
    ) limit 1;
    return;
  end if;

  if not (
    (v_assignment.status = 'accepted' and v_status = 'arrived_restaurant')
    or (v_assignment.status = 'arrived_restaurant' and v_status = 'picked_up')
    or (v_assignment.status = 'picked_up' and v_status = 'arrived_customer')
    or (v_assignment.status = 'arrived_customer' and v_status = 'delivered')
  ) then raise exception 'Assignment transition is not allowed'; end if;

  update public.delivery_assignments da
  set status = v_status,
      delivered_at = case when v_status = 'delivered' then now() else da.delivered_at end,
      delivered_lat = case when v_status = 'delivered' then cl.lat else da.delivered_lat end,
      delivered_lng = case when v_status = 'delivered' then cl.lng else da.delivered_lng end,
      updated_at = now()
  from public.courier_live_locations cl
  where da.id = v_assignment.id and cl.user_id = v_assignment.courier_user_id;

  update public.customer_orders co
  set courier_assignment_status = v_status,
      status = case when v_status = 'picked_up' then 'sent' when v_status = 'delivered' then 'delivered' else co.status end,
      updated_at = now()
  where co.id = v_assignment.customer_order_id;
end;
$$;

create or replace function public.rc_ordera_jsonb_numeric(p_value jsonb, p_default numeric default 0)
returns numeric
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when trim(both '"' from coalesce(p_value::text, '')) ~ '^-?[0-9]+([.][0-9]+)?$'
      then trim(both '"' from p_value::text)::numeric
    else p_default
  end;
$$;

create or replace function public.rc_ordera_delivery_fee_breakdown(
  p_distance_km numeric,
  p_minimum_fee numeric,
  p_extra_fee numeric
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_distance numeric := greatest(coalesce(p_distance_km, 0), 0);
  v_raw numeric := 0;
  v_base numeric := 0;
  v_distance_fee numeric := 0;
  v_before_extra numeric := 0;
  v_operational numeric := 0;
  v_extra numeric := greatest(coalesce(p_extra_fee, 0), 0);
  v_final numeric := 0;
begin
  if v_distance <= 0 then
    return jsonb_build_object('base', 0, 'distance', 0, 'operational', 0, 'platform', 0, 'final', 0);
  end if;

  v_base := 4.50;
  v_raw := v_base;
  if v_distance > 1.5 then v_raw := v_raw + (least(v_distance, 6.0) - 1.5) * 1.50; end if;
  if v_distance > 6.0 then v_raw := v_raw + (least(v_distance, 8.0) - 6.0) * 2.50; end if;
  if v_distance > 8.0 then v_raw := v_raw + (v_distance - 8.0) * 3.50; end if;

  v_raw := round(v_raw, 2);
  v_distance_fee := round(greatest(v_raw - v_base, 0), 2);
  v_before_extra := round(greatest(greatest(coalesce(p_minimum_fee, 20), 0), v_raw * 1.6714285714), 2);
  v_operational := round(v_before_extra - v_raw, 2);
  v_final := round(v_before_extra + v_extra, 2);

  return jsonb_build_object(
    'base', v_base,
    'distance', v_distance_fee,
    'operational', v_operational,
    'platform', round(v_extra, 2),
    'final', v_final
  );
end;
$$;

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
set search_path = pg_catalog, public
as $$
declare
  v_order_id uuid := coalesce(p_id, gen_random_uuid());
  v_existing public.customer_orders%rowtype;
  v_restaurant_country text := '';
  v_restaurant_region text := '';
  v_customer_country text := upper(trim(coalesce(p_order_json #>> '{delivery,countryCode}', '')));
  v_customer_region text := lower(trim(coalesce(p_order_json #>> '{delivery,region}', '')));
  v_restaurant_lat numeric;
  v_restaurant_lng numeric;
  v_customer_lat numeric;
  v_customer_lng numeric;
  v_distance numeric := 0;
  v_straight_distance numeric := 0;
  v_menu jsonb := '{}'::jsonb;
  v_settings jsonb := '{}'::jsonb;
  v_requested_item jsonb;
  v_menu_item jsonb;
  v_product_id text;
  v_quantity integer;
  v_unit_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_clean_items jsonb := '[]'::jsonb;
  v_delivery jsonb;
  v_fee jsonb := jsonb_build_object('base', 0, 'distance', 0, 'operational', 0, 'platform', 0, 'final', 0);
  v_minimum_fee numeric := 20;
  v_extra_fee numeric := 0;
  v_final_delivery numeric := 0;
  v_final_total numeric := 0;
  v_currency text := '';
  v_payload jsonb;
begin
  if p_user_id is null then raise exception 'Restaurant is required'; end if;
  if p_public_token is null or length(trim(p_public_token)) < 8 then raise exception 'Invalid public token'; end if;

  select co.* into v_existing from public.customer_orders co where co.id = v_order_id;
  if found then
    if v_existing.user_id = p_user_id
       and v_existing.public_token = p_public_token
       and v_existing.customer_user_id is not distinct from auth.uid() then
      return query select v_existing.id, v_existing.public_token;
      return;
    end if;
    raise exception 'Idempotency conflict';
  end if;

  select
    upper(trim(coalesce(rp.country_code, ''))),
    lower(trim(coalesce(rp.region, ''))),
    rp.latitude,
    rp.longitude,
    coalesce(s.menu, '{}'::jsonb),
    coalesce(s.settings, '{}'::jsonb)
  into v_restaurant_country, v_restaurant_region, v_restaurant_lat, v_restaurant_lng, v_menu, v_settings
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

  if coalesce(p_order_type, '') = 'Domicilio'
     and v_restaurant_country <> '' and v_customer_country <> ''
     and v_restaurant_country <> v_customer_country then
    raise exception 'Restaurant country does not match delivery country';
  end if;
  if coalesce(p_order_type, '') = 'Domicilio'
     and v_restaurant_region <> '' and v_customer_region <> ''
     and v_restaurant_region <> v_customer_region then
    raise exception 'Restaurant region does not match delivery region';
  end if;

  if jsonb_typeof(coalesce(p_order_json->'items', 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_order_json->'items') = 0 then
    raise exception 'Invalid product list';
  end if;

  for v_requested_item in select value from jsonb_array_elements(p_order_json->'items')
  loop
    v_product_id := trim(coalesce(v_requested_item->>'product_id', ''));
    if v_product_id = '' then raise exception 'Invalid product'; end if;

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
    if v_quantity < 1 or v_quantity > 100 then raise exception 'Invalid product quantity'; end if;
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
        'note', upper(left(coalesce(v_requested_item #>> '{options_snapshot,note}', v_requested_item->>'note', ''), 1000))
      ),
      'total_snapshot', v_line_total,
      'name', left(trim(coalesce(v_menu_item->>'name', 'Producto')), 200),
      'description', left(coalesce(v_menu_item->>'description', ''), 1000),
      'price', v_unit_price,
      'qty', v_quantity,
      'note', upper(left(coalesce(v_requested_item->>'note', ''), 1000))
    ));
    v_menu_item := null;
  end loop;

  v_subtotal := round(v_subtotal, 2);
  v_delivery := coalesce(p_order_json->'delivery', 'null'::jsonb);
  if coalesce(p_order_type, '') = 'Domicilio' then
    v_distance := greatest(public.rc_ordera_jsonb_numeric(v_delivery->'distanceKm', 0), 0);
    v_customer_lat := public.rc_ordera_jsonb_numeric(v_delivery #> '{location,lat}', null);
    v_customer_lng := public.rc_ordera_jsonb_numeric(v_delivery #> '{location,lng}', null);
    if v_restaurant_lat is not null and v_restaurant_lng is not null
       and v_customer_lat between -90 and 90 and v_customer_lng between -180 and 180 then
      v_straight_distance := public.distance_km(v_restaurant_lat, v_restaurant_lng, v_customer_lat, v_customer_lng);
      v_distance := greatest(v_distance, v_straight_distance);
    end if;
    if v_distance <= 0 then raise exception 'Invalid delivery distance'; end if;

    v_minimum_fee := greatest(public.rc_ordera_jsonb_numeric(v_settings->'deliveryMinimumFee', 20), 0);
    v_extra_fee := greatest(public.rc_ordera_jsonb_numeric(v_settings->'deliveryFee', 0), 0);
    v_fee := public.rc_ordera_delivery_fee_breakdown(v_distance, v_minimum_fee, v_extra_fee);
    v_final_delivery := public.rc_ordera_jsonb_numeric(v_fee->'final', 0);
    v_delivery := coalesce(v_delivery, '{}'::jsonb) || jsonb_build_object(
      'distanceKm', round(v_distance, 3),
      'serverValidated', true,
      'fee', v_final_delivery,
      'feeBreakdown', v_fee
    );
  else
    v_delivery := 'null'::jsonb;
  end if;

  v_currency := case
    when upper(coalesce(v_settings->>'currencySymbol', '')) like '%PLN%'
      or coalesce(v_settings->>'currencySymbol', '') like '%zl%'
      or coalesce(v_settings->>'currencySymbol', '') like '%zł%' then 'PLN'
    when v_restaurant_country = 'PL' then 'PLN'
    when v_restaurant_country = 'CO' then 'COP'
    else upper(left(coalesce(v_settings->>'currencyCode', ''), 3))
  end;
  v_final_total := round(v_subtotal + v_final_delivery, 2);
  v_payload := coalesce(p_order_json, '{}'::jsonb) || jsonb_build_object(
    'items', v_clean_items,
    'delivery', v_delivery,
    'subtotal', v_subtotal,
    'total', v_final_total,
    'currency', v_currency,
    'pricingSource', 'server-v82'
  );

  return query
  insert into public.customer_orders (
    id, idempotency_key, public_token, user_id, customer_user_id, status, table_label,
    customer_name, order_type, order_json, total, currency, subtotal,
    base_delivery_fee, distance_fee, operational_adjustment, platform_adjustment,
    final_delivery_fee, payment_method, payment_status, payment_amount, payment_currency,
    created_at, updated_at
  ) values (
    v_order_id, v_order_id::text, trim(p_public_token), p_user_id, auth.uid(), 'pending',
    left(coalesce(p_table_label, ''), 160), left(coalesce(p_customer_name, ''), 160),
    coalesce(p_order_type, 'Comer en el punto'), v_payload, v_final_total, v_currency, v_subtotal,
    public.rc_ordera_jsonb_numeric(v_fee->'base', 0),
    public.rc_ordera_jsonb_numeric(v_fee->'distance', 0),
    public.rc_ordera_jsonb_numeric(v_fee->'operational', 0),
    public.rc_ordera_jsonb_numeric(v_fee->'platform', 0),
    v_final_delivery,
    left(coalesce(p_order_json->>'paymentMethod', ''), 80), 'pending', v_final_total, v_currency,
    now(), now()
  )
  returning public.customer_orders.id, public.customer_orders.public_token;
end;
$$;

create or replace function public.rc_ordera_notify_delivery_offer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'offered' then
    insert into public.notifications (
      recipient_user_id, notification_type, title, body,
      reference_type, reference_id, channels, payload
    ) values (
      new.courier_user_id,
      'courier_assigned',
      'Nuevo domicilio - RC ORDERA',
      'Hay un nuevo pedido disponible. Abre RC ORDERA para revisarlo.',
      'delivery_assignment',
      new.id,
      '["in_app","push"]'::jsonb,
      jsonb_build_object(
        'assignment_id', new.id,
        'customer_order_id', new.customer_order_id,
        'url', './colaborador.html?view=offers'
      )
    )
    on conflict (recipient_user_id, notification_type, reference_type, reference_id)
      where reference_id is not null
    do update set payload = excluded.payload, created_at = now(), read_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists rc_ordera_notify_delivery_offer_trigger on public.delivery_assignments;
create trigger rc_ordera_notify_delivery_offer_trigger
after insert or update of status on public.delivery_assignments
for each row
when (new.status = 'offered')
execute function public.rc_ordera_notify_delivery_offer();

revoke all on function public.rc_ordera_is_platform_admin(uuid) from public, anon;
revoke all on function public.rc_ordera_actor_role(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rc_ordera_can_access_order(uuid) from public, anon;
revoke all on function public.set_courier_availability(boolean) from public, anon;
revoke all on function public.upsert_courier_live_location(boolean, numeric, numeric, integer) from public, anon;
revoke all on function public.review_courier_profile(uuid, text) from public, anon;
revoke all on function public.update_delivery_assignment_status(uuid, text) from public, anon;
revoke all on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) from public;

grant execute on function public.rc_ordera_is_platform_admin(uuid) to authenticated;
grant execute on function public.rc_ordera_can_access_order(uuid) to authenticated;
grant execute on function public.set_courier_availability(boolean) to authenticated;
grant execute on function public.upsert_courier_live_location(boolean, numeric, numeric, integer) to authenticated;
grant execute on function public.review_courier_profile(uuid, text) to authenticated;
grant execute on function public.update_delivery_assignment_status(uuid, text) to authenticated;
grant execute on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) to anon, authenticated;

grant select on public.order_status_history to authenticated;
grant select on public.platform_audit_logs to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.courier_push_subscriptions to authenticated;

-- Direct writes would bypass the validated RPC contracts.
revoke insert on public.customer_orders from authenticated;
revoke insert, update on public.courier_live_locations from authenticated;
revoke insert, update on public.delivery_assignments from authenticated;
revoke insert, update, delete on public.order_status_history from anon, authenticated;
revoke insert, update, delete on public.platform_audit_logs from anon, authenticated;

do $realtime$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'delivery_assignments'
    ) then execute 'alter publication supabase_realtime add table public.delivery_assignments'; end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then execute 'alter publication supabase_realtime add table public.notifications'; end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_status_history'
    ) then execute 'alter publication supabase_realtime add table public.order_status_history'; end if;
  end if;
end;
$realtime$;

do $verify$
begin
  if to_regprocedure('public.set_courier_availability(boolean)') is null
     or to_regprocedure('public.update_delivery_assignment_status(uuid,text)') is null
     or to_regprocedure('public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,numeric)') is null
     or to_regclass('public.order_status_history') is null
     or to_regclass('public.courier_push_subscriptions') is null
     or to_regclass('public.notifications') is null then
    raise exception 'V82 no pudo completar su contrato de estabilidad.';
  end if;
end;
$verify$;

notify pgrst, 'reload schema';

commit;

