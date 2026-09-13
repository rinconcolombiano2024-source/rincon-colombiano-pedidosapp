-- Aplicar en TEST antes de desplegar marketplace-webhook. No mueve dinero.
-- Requiere V85-03 y V86-02; no sustituye ni renombra migraciones anteriores.
begin;

alter table public.marketplace_payment_allocations
  add column if not exists dispute_hold_owned boolean not null default false;

create table if not exists public.marketplace_payment_disputes (
  provider_dispute_id text primary key,
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
  status text not null check (status in (
    'warning_needs_response', 'warning_under_review', 'warning_closed',
    'needs_response', 'under_review', 'won', 'lost', 'prevented'
  )),
  last_event_created bigint not null,
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_disputes_payment_idx
  on public.marketplace_payment_disputes (payment_transaction_id);
alter table public.marketplace_payment_disputes enable row level security;
revoke all on public.marketplace_payment_disputes from public, anon, authenticated;
grant all on public.marketplace_payment_disputes to service_role;

create or replace function public.rc_ordera_reconcile_payment_dispute(
  p_payment_transaction_id uuid,
  p_provider_dispute_id text,
  p_status text,
  p_event_created bigint
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment public.payment_transactions%rowtype;
  v_allocation public.marketplace_payment_allocations%rowtype;
  v_previous public.marketplace_payment_disputes%rowtype;
  v_blocked boolean;
begin
  if coalesce(p_provider_dispute_id, '') !~ '^du_[A-Za-z0-9]+$'
     or p_event_created is null or p_event_created < 0
     or p_status is null or p_status not in (
       'warning_needs_response', 'warning_under_review', 'warning_closed',
       'needs_response', 'under_review', 'won', 'lost', 'prevented'
     ) then raise exception 'Invalid dispute'; end if;

  select * into v_payment from public.payment_transactions
    where id = p_payment_transaction_id for update;
  if not found then raise exception 'Payment transaction was not found'; end if;
  select * into v_allocation from public.marketplace_payment_allocations
    where payment_transaction_id = p_payment_transaction_id for update;
  if not found then raise exception 'Payment allocation was not found'; end if;
  select * into v_previous from public.marketplace_payment_disputes
    where provider_dispute_id = p_provider_dispute_id for update;
  if found then
    if v_previous.payment_transaction_id <> p_payment_transaction_id then
      raise exception 'Dispute belongs to another payment';
    end if;
    if p_event_created < v_previous.last_event_created
       or (v_previous.status in ('won','lost','warning_closed','prevented')
           and p_status not in ('won','lost','warning_closed','prevented')) then
      return 'stale';
    end if;
  end if;
  insert into public.marketplace_payment_disputes
    (provider_dispute_id, payment_transaction_id, status, last_event_created)
  values (p_provider_dispute_id, p_payment_transaction_id, p_status, p_event_created)
  on conflict (provider_dispute_id) do update set
    status = excluded.status, last_event_created = excluded.last_event_created, updated_at = now();

  select exists (
    select 1 from public.marketplace_payment_disputes
    where payment_transaction_id = p_payment_transaction_id
      and status not in ('won', 'warning_closed', 'prevented')
  ) into v_blocked;

  if v_blocked then
    -- Solo somos propietarios de una retencion creada por esta funcion.
    -- Una retencion manual, de refund o heredada nunca se libera por inferencia.
    update public.marketplace_payment_allocations
    set financial_hold = true,
        dispute_hold_owned = not v_allocation.financial_hold
          or (v_allocation.dispute_hold_owned and v_allocation.hold_reason = 'RC_ORDERA_DISPUTE_HOLD'),
        hold_reason = case when not v_allocation.financial_hold
          or (v_allocation.dispute_hold_owned and v_allocation.hold_reason = 'RC_ORDERA_DISPUTE_HOLD')
          then 'RC_ORDERA_DISPUTE_HOLD' else hold_reason end,
        dispute_status = case when exists (
          select 1 from public.marketplace_payment_disputes
          where payment_transaction_id = p_payment_transaction_id and status = 'lost'
        ) then 'lost' else (
          select d.status from public.marketplace_payment_disputes d
          where d.payment_transaction_id = p_payment_transaction_id
            and d.status not in ('won','warning_closed','prevented')
          order by d.updated_at desc limit 1
        ) end,
        updated_at = now()
    where id = v_allocation.id;
    return 'held';
  end if;

  if v_allocation.dispute_hold_owned
     and v_allocation.hold_reason = 'RC_ORDERA_DISPUTE_HOLD'
     and v_allocation.refund_amount = 0
     and v_payment.status = 'paid'
     and v_allocation.status <> 'refunded' then
    update public.marketplace_payment_allocations a
    set financial_hold = false, dispute_hold_owned = false, hold_reason = '',
        dispute_status = p_status,
        restaurant_release_eligible_at = coalesce(a.restaurant_release_eligible_at,
          (select now() from public.customer_orders co
           where co.id = a.customer_order_id and co.status = 'delivered' and co.payment_status = 'paid')),
        updated_at = now()
    where a.id = v_allocation.id;
    -- El trigger existente en allocations reencola la liquidacion si es elegible.
    return 'released';
  end if;
  update public.marketplace_payment_allocations
    set dispute_status = p_status, updated_at = now() where id = v_allocation.id;
  return case when v_allocation.financial_hold then 'held_other_reason' else 'closed' end;
end;
$$;
revoke all on function public.rc_ordera_reconcile_payment_dispute(uuid,text,text,bigint) from public, anon, authenticated;
grant execute on function public.rc_ordera_reconcile_payment_dispute(uuid,text,text,bigint) to service_role;
notify pgrst, 'reload schema';
commit;
