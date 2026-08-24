-- RC ORDERA V86.02
-- Validacion atomica de pagos, cola durable de liquidaciones y bloqueos financieros.
-- Requiere V85.03. No activa Stripe por si sola y no modifica importes historicos.

begin;

do $preflight$
begin
  if to_regclass('public.payment_transactions') is null
     or to_regclass('public.refund_transactions') is null
     or to_regclass('public.marketplace_payment_allocations') is null
     or to_regclass('public.payment_provider_events') is null
     or to_regclass('public.delivery_completion_confirmations') is null then
    raise exception 'Falta la estructura de pagos V84/V85.03.';
  end if;
  if to_regprocedure('public.rc_ordera_calculate_marketplace_allocation(uuid)') is null then
    raise exception 'Falta rc_ordera_calculate_marketplace_allocation de V85.03.';
  end if;
end;
$preflight$;

-- Los porcentajes solicitados son 5% y 0,1%. Esta operacion es idempotente.
insert into public.marketplace_finance_config (
  id, restaurant_fee_bps, courier_fee_bps, updated_at
) values (
  true, 500, 10, now()
)
on conflict (id) do update set
  restaurant_fee_bps = excluded.restaurant_fee_bps,
  courier_fee_bps = excluded.courier_fee_bps,
  updated_at = now();

alter table public.marketplace_payment_allocations
  add column if not exists financial_hold boolean not null default false,
  add column if not exists hold_reason text not null default '',
  add column if not exists refund_amount numeric(12, 2) not null default 0 check (refund_amount >= 0),
  add column if not exists dispute_status text not null default '';

create table if not exists public.marketplace_settlement_jobs (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null unique references public.marketplace_payment_allocations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz null,
  completed_at timestamptz null,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_settlement_jobs_ready_idx
  on public.marketplace_settlement_jobs (status, available_at, created_at);

alter table public.marketplace_settlement_jobs enable row level security;
revoke all on table public.marketplace_settlement_jobs from public, anon, authenticated;

create or replace function public.rc_ordera_queue_settlement_job()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status not in ('settled', 'refunded')
     and new.financial_hold = false
     and (
       (new.restaurant_release_eligible_at is not null and new.restaurant_transfer_id = '')
       or (new.courier_release_eligible_at is not null and new.courier_transfer_id = '')
     ) then
    insert into public.marketplace_settlement_jobs (
      allocation_id, status, available_at, locked_at, completed_at, last_error, updated_at
    ) values (
      new.id, 'pending', now(), null, null, '', now()
    )
    on conflict (allocation_id) do update set
      status = case
        when marketplace_settlement_jobs.status = 'processing'
             and marketplace_settlement_jobs.locked_at > now() - interval '10 minutes'
          then 'processing'
        else 'pending'
      end,
      available_at = case
        when marketplace_settlement_jobs.status = 'processing'
             and marketplace_settlement_jobs.locked_at > now() - interval '10 minutes'
          then marketplace_settlement_jobs.available_at
        else now()
      end,
      completed_at = null,
      last_error = '',
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists rc_ordera_queue_settlement_job_trigger on public.marketplace_payment_allocations;
create trigger rc_ordera_queue_settlement_job_trigger
after insert or update of status, restaurant_release_eligible_at, courier_release_eligible_at,
  restaurant_transfer_id, courier_transfer_id, financial_hold
on public.marketplace_payment_allocations
for each row execute function public.rc_ordera_queue_settlement_job();

create or replace function public.claim_marketplace_settlement_jobs(p_limit integer default 25)
returns table (job_id uuid, allocation_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  with candidates as (
    select j.id
    from public.marketplace_settlement_jobs j
    join public.marketplace_payment_allocations a on a.id = j.allocation_id
    where (
      j.status in ('pending', 'failed')
      or (j.status = 'processing' and j.locked_at < now() - interval '10 minutes')
    )
      and j.available_at <= now()
      and a.financial_hold = false
      and a.status not in ('settled', 'refunded')
    order by j.available_at, j.created_at
    for update of j skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  )
  update public.marketplace_settlement_jobs j
  set status = 'processing',
      attempts = j.attempts + 1,
      locked_at = now(),
      last_error = '',
      updated_at = now()
  from candidates c
  where j.id = c.id
  returning j.id, j.allocation_id;
end;
$$;

create or replace function public.complete_marketplace_settlement_job(
  p_job_id uuid,
  p_completed boolean,
  p_error text default ''
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.marketplace_settlement_jobs j
  set status = case when p_completed then 'completed' else 'failed' end,
      completed_at = case when p_completed then now() else null end,
      available_at = case
        when p_completed then j.available_at
        else now() + make_interval(secs => least(3600, greatest(30, (j.attempts * j.attempts) * 30)))
      end,
      locked_at = null,
      last_error = left(trim(coalesce(p_error, '')), 1000),
      updated_at = now()
  where j.id = p_job_id;
end;
$$;

create or replace function public.rc_ordera_mark_payment_succeeded(
  p_payment_transaction_id uuid,
  p_provider_session_id text,
  p_provider_reference text,
  p_amount numeric,
  p_currency text
)
returns table (
  payment_transaction_id uuid,
  customer_order_id uuid,
  allocation_id uuid,
  already_paid boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment public.payment_transactions%rowtype;
  v_order public.customer_orders%rowtype;
  v_allocation_id uuid;
  v_was_paid boolean;
  v_now timestamptz := now();
begin
  select pt.* into v_payment
  from public.payment_transactions pt
  where pt.id = p_payment_transaction_id
  for update;
  if not found then raise exception 'Payment transaction was not found'; end if;
  if v_payment.provider <> 'stripe_connect' then raise exception 'Unexpected payment provider'; end if;
  if v_payment.status in ('refunded', 'partially_refunded') then raise exception 'Payment was already refunded'; end if;
  if v_payment.status not in ('pending', 'authorized', 'paid') then raise exception 'Payment cannot be completed'; end if;

  if trim(coalesce(v_payment.provider_session_id, '')) <> ''
     and trim(coalesce(p_provider_session_id, '')) <> ''
     and v_payment.provider_session_id <> trim(p_provider_session_id) then
    raise exception 'Payment session does not match';
  end if;
  if trim(coalesce(v_payment.provider_reference, '')) <> ''
     and trim(coalesce(p_provider_reference, '')) <> ''
     and v_payment.provider_reference <> trim(p_provider_reference) then
    raise exception 'Payment reference does not match';
  end if;
  if round(v_payment.amount, 2) <> round(coalesce(p_amount, -1), 2)
     or upper(trim(v_payment.currency)) <> upper(trim(coalesce(p_currency, ''))) then
    raise exception 'Payment amount or currency does not match';
  end if;

  select co.* into v_order
  from public.customer_orders co
  where co.id = v_payment.customer_order_id
  for update;
  if not found then raise exception 'Order was not found'; end if;
  if round(v_order.total, 2) <> round(v_payment.amount, 2)
     or upper(trim(v_order.currency)) <> upper(trim(v_payment.currency)) then
    raise exception 'Order total or currency does not match payment';
  end if;

  v_was_paid := v_payment.status = 'paid';
  update public.payment_transactions pt
  set status = 'paid',
      provider_session_id = coalesce(nullif(trim(p_provider_session_id), ''), pt.provider_session_id),
      provider_reference = coalesce(nullif(trim(p_provider_reference), ''), pt.provider_reference),
      paid_at = coalesce(pt.paid_at, v_now),
      updated_at = v_now
  where pt.id = v_payment.id;

  update public.customer_orders co
  set payment_status = 'paid',
      payment_method = 'Online',
      payment_provider = 'stripe_connect',
      provider_reference = coalesce(nullif(trim(p_provider_reference), ''), co.provider_reference),
      payment_amount = v_payment.amount,
      payment_currency = upper(v_payment.currency),
      paid_at = coalesce(co.paid_at, v_now),
      updated_at = v_now
  where co.id = v_order.id;

  v_allocation_id := public.rc_ordera_calculate_marketplace_allocation(v_payment.id);
  return query select v_payment.id, v_order.id, v_allocation_id, v_was_paid;
end;
$$;

create or replace function public.rc_ordera_mark_payment_failed(
  p_payment_transaction_id uuid,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment public.payment_transactions%rowtype;
begin
  select pt.* into v_payment
  from public.payment_transactions pt
  where pt.id = p_payment_transaction_id
  for update;
  if not found then raise exception 'Payment transaction was not found'; end if;
  if v_payment.status in ('paid', 'refunded', 'partially_refunded') then return; end if;

  update public.payment_transactions pt
  set status = 'failed',
      failed_at = coalesce(pt.failed_at, now()),
      metadata = pt.metadata || jsonb_build_object('failure_reason', left(trim(coalesce(p_reason, '')), 500)),
      updated_at = now()
  where pt.id = v_payment.id;

  update public.customer_orders co
  set payment_status = 'failed', updated_at = now()
  where co.id = v_payment.customer_order_id
    and co.payment_status <> 'paid';
end;
$$;

create or replace function public.rc_ordera_record_payment_refund(
  p_payment_transaction_id uuid,
  p_provider_refund_id text,
  p_amount numeric,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment public.payment_transactions%rowtype;
  v_refunded_total numeric(12, 2);
  v_status text;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Refund amount is invalid'; end if;
  select pt.* into v_payment
  from public.payment_transactions pt
  where pt.id = p_payment_transaction_id
  for update;
  if not found then raise exception 'Payment transaction was not found'; end if;
  if upper(trim(v_payment.currency)) <> upper(trim(coalesce(p_currency, ''))) then
    raise exception 'Refund currency does not match';
  end if;

  insert into public.refund_transactions (
    payment_transaction_id, customer_order_id, status, amount, currency,
    reason, provider_reference, idempotency_key, processed_at, updated_at
  ) values (
    v_payment.id, v_payment.customer_order_id, 'refunded', round(p_amount, 2), upper(v_payment.currency),
    'Notificado por proveedor', left(trim(coalesce(p_provider_refund_id, '')), 240),
    'provider-refund:' || left(trim(coalesce(p_provider_refund_id, '')), 240), now(), now()
  ) on conflict (payment_transaction_id, idempotency_key) do update set
    status = 'refunded', processed_at = coalesce(refund_transactions.processed_at, now()), updated_at = now();

  select coalesce(sum(r.amount), 0) into v_refunded_total
  from public.refund_transactions r
  where r.payment_transaction_id = v_payment.id and r.status = 'refunded';
  v_status := case when v_refunded_total >= v_payment.amount then 'refunded' else 'partially_refunded' end;

  update public.payment_transactions pt
  set status = v_status, updated_at = now()
  where pt.id = v_payment.id;
  update public.customer_orders co
  set payment_status = v_status,
      refunded_at = case when v_status = 'refunded' then coalesce(co.refunded_at, now()) else co.refunded_at end,
      updated_at = now()
  where co.id = v_payment.customer_order_id;
  update public.marketplace_payment_allocations a
  set financial_hold = true,
      hold_reason = 'Refund reported by payment provider',
      refund_amount = least(v_refunded_total, a.gross_amount),
      status = 'refunded',
      updated_at = now()
  where a.payment_transaction_id = v_payment.id;

  return v_status;
end;
$$;

create or replace function public.rc_ordera_hold_payment_for_dispute(
  p_payment_transaction_id uuid,
  p_dispute_status text,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.marketplace_payment_allocations a
  set financial_hold = true,
      hold_reason = left(trim(coalesce(p_reason, 'Payment dispute')), 500),
      dispute_status = left(trim(coalesce(p_dispute_status, 'open')), 80),
      updated_at = now()
  where a.payment_transaction_id = p_payment_transaction_id;
end;
$$;

create or replace function public.rc_ordera_mark_restaurant_release_eligible()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'delivered'
     and old.status is distinct from new.status
     and lower(trim(coalesce(new.payment_status, ''))) = 'paid' then
    update public.marketplace_payment_allocations a
    set restaurant_release_eligible_at = coalesce(a.restaurant_release_eligible_at, now()),
        status = case when a.courier_release_eligible_at is not null then 'eligible' else a.status end,
        updated_at = now()
    where a.customer_order_id = new.id
      and a.financial_hold = false
      and a.status not in ('settled', 'refunded');
  end if;
  return new;
end;
$$;

drop trigger if exists rc_ordera_v86_restaurant_release_trigger on public.customer_orders;
create trigger rc_ordera_v86_restaurant_release_trigger
after update of status on public.customer_orders
for each row execute function public.rc_ordera_mark_restaurant_release_eligible();

create or replace function public.rc_ordera_persist_courier_delivery_confirmation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'delivered' and old.status is distinct from new.status then
    insert into public.delivery_completion_confirmations (
      customer_order_id, delivery_assignment_id, customer_user_id, courier_user_id,
      courier_confirmed_at, updated_at
    )
    select co.id, new.id, co.customer_user_id, new.courier_user_id, now(), now()
    from public.customer_orders co
    where co.id = new.customer_order_id
    on conflict (customer_order_id) do update set
      delivery_assignment_id = excluded.delivery_assignment_id,
      courier_user_id = excluded.courier_user_id,
      courier_confirmed_at = coalesce(delivery_completion_confirmations.courier_confirmed_at, now()),
      completed_at = case
        when delivery_completion_confirmations.customer_confirmed_at is not null
          then coalesce(delivery_completion_confirmations.completed_at, now())
        else delivery_completion_confirmations.completed_at
      end,
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists rc_ordera_v86_courier_confirmation_trigger on public.delivery_assignments;
create trigger rc_ordera_v86_courier_confirmation_trigger
after update of status on public.delivery_assignments
for each row execute function public.rc_ordera_persist_courier_delivery_confirmation();

-- Reponer trabajos que ya eran elegibles antes de esta migracion.
insert into public.marketplace_settlement_jobs (allocation_id, status, available_at, updated_at)
select a.id, 'pending', now(), now()
from public.marketplace_payment_allocations a
where a.status not in ('settled', 'refunded')
  and a.financial_hold = false
  and (
    (a.restaurant_release_eligible_at is not null and a.restaurant_transfer_id = '')
    or (a.courier_release_eligible_at is not null and a.courier_transfer_id = '')
  )
on conflict (allocation_id) do nothing;

revoke all on function public.rc_ordera_queue_settlement_job() from public, anon, authenticated;
revoke all on function public.claim_marketplace_settlement_jobs(integer) from public, anon, authenticated;
revoke all on function public.complete_marketplace_settlement_job(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.rc_ordera_mark_payment_succeeded(uuid, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.rc_ordera_mark_payment_failed(uuid, text) from public, anon, authenticated;
revoke all on function public.rc_ordera_record_payment_refund(uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.rc_ordera_hold_payment_for_dispute(uuid, text, text) from public, anon, authenticated;
revoke all on function public.rc_ordera_mark_restaurant_release_eligible() from public, anon, authenticated;
revoke all on function public.rc_ordera_persist_courier_delivery_confirmation() from public, anon, authenticated;

grant execute on function public.claim_marketplace_settlement_jobs(integer) to service_role;
grant execute on function public.complete_marketplace_settlement_job(uuid, boolean, text) to service_role;
grant execute on function public.rc_ordera_mark_payment_succeeded(uuid, text, text, numeric, text) to service_role;
grant execute on function public.rc_ordera_mark_payment_failed(uuid, text) to service_role;
grant execute on function public.rc_ordera_record_payment_refund(uuid, text, numeric, text) to service_role;
grant execute on function public.rc_ordera_hold_payment_for_dispute(uuid, text, text) to service_role;

notify pgrst, 'reload schema';

commit;
