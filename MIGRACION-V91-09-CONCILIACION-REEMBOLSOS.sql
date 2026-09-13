-- V85-03 y V86-02 deben existir. Solo reversiones de reembolso TOTAL.
-- Parciales conservan el hold existente: no se inventa reparto de perdidas.
begin;
create table if not exists public.marketplace_refund_reversals (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.marketplace_payment_allocations(id) on delete restrict,
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
  transfer_id text not null unique,
  expected_amount_minor bigint not null check (expected_amount_minor > 0),
  currency text not null,
  amount_minor bigint null check (amount_minor > 0),
  status text not null default 'pending' check (status in ('pending','processing','failed','confirmed','manual_review')),
  attempts integer not null default 0,
  lease_token uuid null,
  available_at timestamptz not null default now(),
  first_attempt_at timestamptz null,
  provider_reversal_id text not null default '',
  receipt jsonb not null default '{}'::jsonb,
  last_error text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_refund_reversals_due_idx
  on public.marketplace_refund_reversals (available_at)
  where status in ('pending','processing','failed');
alter table public.marketplace_refund_reversals enable row level security;
revoke all on public.marketplace_refund_reversals from public,anon,authenticated;
grant all on public.marketplace_refund_reversals to service_role;

create or replace function public.rc_ordera_preserve_refund_allocation()
returns trigger language plpgsql set search_path = pg_catalog,public as $$
begin
  -- Un settlement iniciado antes del refund puede terminar despues.
  -- Guardamos sus IDs sin permitir que una respuesta antigua quite el hold.
  if old.refund_amount > new.refund_amount then new.refund_amount := old.refund_amount; end if;
  if new.refund_amount > 0 then
    new.financial_hold := true;
    new.status := 'refunded';
    new.hold_reason := 'Refund reported by payment provider';
  end if;
  if old.restaurant_transfer_id <> '' then
    if new.restaurant_transfer_id not in ('',old.restaurant_transfer_id) then raise exception 'Restaurant transfer mismatch'; end if;
    new.restaurant_transfer_id := old.restaurant_transfer_id;
  end if;
  if old.courier_transfer_id <> '' then
    if new.courier_transfer_id not in ('',old.courier_transfer_id) then raise exception 'Courier transfer mismatch'; end if;
    new.courier_transfer_id := old.courier_transfer_id;
  end if;
  return new;
end;
$$;
drop trigger if exists rc_ordera_preserve_refund_allocation on public.marketplace_payment_allocations;
create trigger rc_ordera_preserve_refund_allocation before update on public.marketplace_payment_allocations
for each row execute function public.rc_ordera_preserve_refund_allocation();

create or replace function public.rc_ordera_queue_refund_reversals()
returns trigger language plpgsql security definer set search_path = pg_catalog,public as $$
begin
  if new.refund_amount < new.gross_amount or new.gross_amount <= 0 then return new; end if;
  insert into public.marketplace_refund_reversals
    (allocation_id,payment_transaction_id,transfer_id,expected_amount_minor,currency)
  select new.id,new.payment_transaction_id,t.transfer_id,round(t.amount*100)::bigint,upper(new.currency)
  from (values (new.restaurant_transfer_id,new.restaurant_net_amount),
               (new.courier_transfer_id,new.courier_net_amount)) as t(transfer_id,amount)
  where t.transfer_id <> '' and t.amount > 0
  on conflict (transfer_id) do nothing;
  return new;
end;
$$;
drop trigger if exists rc_ordera_queue_refund_reversals on public.marketplace_payment_allocations;
create trigger rc_ordera_queue_refund_reversals after insert or update of
  refund_amount,restaurant_transfer_id,courier_transfer_id on public.marketplace_payment_allocations
for each row execute function public.rc_ordera_queue_refund_reversals();

create or replace function public.rc_ordera_record_verified_refund(
  p_payment_transaction_id uuid, p_provider_refund_id text, p_amount numeric, p_currency text
) returns text language plpgsql security definer set search_path = pg_catalog,public as $$
declare
  v_payment public.payment_transactions%rowtype;
  v_previous public.refund_transactions%rowtype;
  v_total numeric;
begin
  if coalesce(p_provider_refund_id,'') !~ '^re_[A-Za-z0-9]+$'
    or p_amount is null or p_amount <= 0 or p_amount::text in ('NaN','Infinity','-Infinity')
    or round(p_amount,2) <> p_amount then raise exception 'Invalid refund'; end if;
  select * into v_payment from public.payment_transactions where id=p_payment_transaction_id for update;
  if not found then raise exception 'Payment transaction was not found'; end if;
  if upper(coalesce(p_currency,'')) <> upper(v_payment.currency) then raise exception 'Refund currency mismatch'; end if;
  select * into v_previous from public.refund_transactions
    where payment_transaction_id=p_payment_transaction_id and idempotency_key='provider-refund:'||p_provider_refund_id;
  if found and (v_previous.amount <> p_amount or upper(v_previous.currency) <> upper(p_currency)) then
    raise exception 'Refund id reused with different financial fields';
  end if;
  select coalesce(sum(amount),0) into v_total from public.refund_transactions
    where payment_transaction_id=p_payment_transaction_id and status='refunded'
      and idempotency_key <> 'provider-refund:'||p_provider_refund_id;
  if v_total+p_amount > v_payment.amount then raise exception 'Refund exceeds payment'; end if;
  return public.rc_ordera_record_payment_refund(p_payment_transaction_id,p_provider_refund_id,p_amount,p_currency);
end;
$$;

create or replace function public.rc_ordera_claim_refund_reversals(p_payment_transaction_id uuid default null)
returns setof public.marketplace_refund_reversals
language sql security definer set search_path = pg_catalog,public as $$
  with candidates as (
    select id from public.marketplace_refund_reversals
    where status in ('pending','processing','failed') and available_at <= now()
      and (p_payment_transaction_id is null or payment_transaction_id=p_payment_transaction_id)
    order by available_at limit 25 for update skip locked
  )
  update public.marketplace_refund_reversals r set
    status='processing', lease_token=gen_random_uuid(), attempts=attempts+1,
    available_at=now()+interval '10 minutes', updated_at=now()
  from candidates c where r.id=c.id returning r.*;
$$;
create or replace function public.rc_ordera_reserve_refund_reversal_amount(p_id uuid,p_lease_token uuid,p_amount_minor bigint)
returns bigint language plpgsql security definer set search_path = pg_catalog,public as $$
declare v_amount bigint;
begin
  update public.marketplace_refund_reversals
    set amount_minor=coalesce(amount_minor,p_amount_minor),
        first_attempt_at=coalesce(first_attempt_at,now()),updated_at=now()
    where id=p_id and lease_token=p_lease_token and status='processing'
      and p_amount_minor>0 and p_amount_minor<=expected_amount_minor
    returning amount_minor into v_amount;
  if not found then raise exception 'Reversal lease or amount is invalid'; end if;
  return v_amount;
end;
$$;
create or replace function public.rc_ordera_finish_refund_reversal(
  p_id uuid,p_lease_token uuid,p_status text,p_reversal_id text,p_receipt jsonb,p_error text
) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_status is null or p_status not in ('confirmed','failed','manual_review') then raise exception 'Invalid result'; end if;
  update public.marketplace_refund_reversals set
    status=p_status,provider_reversal_id=coalesce(p_reversal_id,''),receipt=coalesce(p_receipt,'{}'::jsonb),
    last_error=left(coalesce(p_error,''),1000),lease_token=null,
    available_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::integer),updated_at=now()
    where id=p_id and lease_token=p_lease_token and status='processing';
  return found;
end;
$$;
revoke all on function public.rc_ordera_preserve_refund_allocation() from public,anon,authenticated;
revoke all on function public.rc_ordera_queue_refund_reversals() from public,anon,authenticated;
revoke all on function public.rc_ordera_record_verified_refund(uuid,text,numeric,text) from public,anon,authenticated;
revoke all on function public.rc_ordera_claim_refund_reversals(uuid) from public,anon,authenticated;
revoke all on function public.rc_ordera_reserve_refund_reversal_amount(uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.rc_ordera_finish_refund_reversal(uuid,uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.rc_ordera_record_verified_refund(uuid,text,numeric,text) to service_role;
grant execute on function public.rc_ordera_claim_refund_reversals(uuid) to service_role;
grant execute on function public.rc_ordera_reserve_refund_reversal_amount(uuid,uuid,bigint) to service_role;
grant execute on function public.rc_ordera_finish_refund_reversal(uuid,uuid,text,text,jsonb,text) to service_role;
-- No se reembolsan cobros ni se ejecutan llamadas Stripe durante esta migracion.
-- Los refunds historicos requieren conciliacion revisada; no se encolan en bloque.
notify pgrst,'reload schema';
commit;
