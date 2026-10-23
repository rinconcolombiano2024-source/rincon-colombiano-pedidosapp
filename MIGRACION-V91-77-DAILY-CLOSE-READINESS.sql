-- RC ORDERA: read-only preflight for day closing. Does not change existing closure RPC.
-- Integrate as a mandatory server-side check only after live schema and payment flow verification.
begin;
create or replace function public.rc_daily_close_readiness(p_business_date date)
returns table(order_id uuid, reason text)
language plpgsql stable security invoker
set search_path = pg_catalog, public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_business_date is null then raise exception 'Business date required'; end if;
  return query
  select o.id,
    case
      when lower(coalesce(nullif(o.canonical_status,''),nullif(o.status,''),o.order_json->>'status','')) not in ('completed','delivered','cancelled','rejected') then 'ORDER_NOT_FINISHED'
      when lower(coalesce(nullif(o.canonical_status,''),nullif(o.status,''),o.order_json->>'status','')) in ('cancelled','rejected') then null
      when lower(coalesce(nullif(o.order_json->>'paymentStatus',''),nullif(o.order_json->>'payment_status',''),'')) not in ('paid','completed','succeeded') then 'PAYMENT_NOT_CONFIRMED'
      when lower(coalesce(nullif(o.order_json->>'paymentMethod',''),nullif(o.order_json->>'payment_method',''),'')) not in ('cash','efectivo','gotowka','gotówka','terminal','card_terminal','datafono','datáfono','card','tarjeta','online','stripe','sumup','blik','transferencia') then 'PAYMENT_METHOD_MISSING'
      else null
    end as reason
  from public.orders o
  where o.user_id = v_user and o.business_date = p_business_date
    and (
      lower(coalesce(nullif(o.canonical_status,''),nullif(o.status,''),o.order_json->>'status','')) not in ('completed','delivered','cancelled','rejected')
      or (lower(coalesce(nullif(o.canonical_status,''),nullif(o.status,''),o.order_json->>'status','')) not in ('cancelled','rejected')
        and (lower(coalesce(nullif(o.order_json->>'paymentStatus',''),nullif(o.order_json->>'payment_status',''),'')) not in ('paid','completed','succeeded')
          or lower(coalesce(nullif(o.order_json->>'paymentMethod',''),nullif(o.order_json->>'payment_method',''),'')) not in ('cash','efectivo','gotowka','gotówka','terminal','card_terminal','datafono','datáfono','card','tarjeta','online','stripe','sumup','blik','transferencia'))));
end;
$$;
revoke all on function public.rc_daily_close_readiness(date) from public, anon;
grant execute on function public.rc_daily_close_readiness(date) to authenticated;
commit;
