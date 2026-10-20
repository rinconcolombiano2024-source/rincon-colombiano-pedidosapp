-- Additive inventory RPCs. STAGING FIRST. Requires V91-75 schema.
-- Intentionally service_role only; Edge Function MUST authorize the caller's restaurant.
begin;
create or replace function public.rc_inventory_receive(
 p_restaurant uuid,p_warehouse uuid,p_ingredient uuid,p_quantity_milli bigint,
 p_cost_minor bigint,p_currency text,p_idempotency_key text
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_lot uuid; v_existing uuid;
begin
 if p_restaurant is null or p_warehouse is null or p_ingredient is null
 or p_quantity_milli is null or p_quantity_milli<=0
 or p_cost_minor is null or p_cost_minor<0 or p_currency not in ('PLN','COP')
 or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 128
 then raise exception 'INVALID_RECEIPT'; end if;
 -- Serializes retries for this restaurant/key, even if concurrent requests arrive.
 perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text||':'||p_idempotency_key,0));
 select lot_id into v_existing from public.rc_inventory_movements
 where restaurant_id=p_restaurant and idempotency_key=p_idempotency_key;
 if found then
  if not exists(select 1 from public.rc_inventory_movements
   where restaurant_id=p_restaurant and idempotency_key=p_idempotency_key
   and movement_type='receipt' and warehouse_id=p_warehouse
   and ingredient_id=p_ingredient and quantity_milli=p_quantity_milli
   and cost_minor=p_cost_minor)
  then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if not exists(select 1 from public.rc_inventory_lots where id=v_existing and currency=p_currency)
  then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return v_existing;
 end if;
 if not exists(select 1 from public.rc_inventory_warehouses
   where restaurant_id=p_restaurant and id=p_warehouse and active)
 or not exists(select 1 from public.rc_inventory_ingredients
   where restaurant_id=p_restaurant and id=p_ingredient and active)
 then raise exception 'INACTIVE_OR_UNKNOWN_SCOPE'; end if;
 insert into public.rc_inventory_lots
 (restaurant_id,warehouse_id,ingredient_id,original_milli,available_milli,original_cost_minor,currency)
 values(p_restaurant,p_warehouse,p_ingredient,p_quantity_milli,p_quantity_milli,p_cost_minor,p_currency)
 returning id into v_lot;
 insert into public.rc_inventory_movements
 (restaurant_id,warehouse_id,ingredient_id,lot_id,idempotency_key,movement_type,quantity_milli,cost_minor)
 values(p_restaurant,p_warehouse,p_ingredient,v_lot,p_idempotency_key,'receipt',p_quantity_milli,p_cost_minor);
 return v_lot;
end $$;
create or replace function public.rc_inventory_issue(
 p_restaurant uuid,p_warehouse uuid,p_ingredient uuid,p_quantity_milli bigint,
 p_idempotency_key text,p_reason text default null
) returns bigint language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_lot record; v_remaining bigint; v_take bigint; v_cost bigint;
 v_total bigint:=0; v_previous bigint; v_existing record; v_index integer:=0;
begin
 if p_restaurant is null or p_warehouse is null or p_ingredient is null
 or p_quantity_milli is null or p_quantity_milli<=0
 or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 110
 or (p_reason is not null and p_reason not in ('desperdicio','rotura','consumo_personal','error_cocina'))
 then raise exception 'INVALID_ISSUE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text||':'||p_idempotency_key,0));
 select sum(quantity_milli) as quantity, sum(cost_minor) as cost,
 min(movement_type) as kind, max(movement_type) as max_kind,
 min(warehouse_id) as warehouse, min(ingredient_id) as ingredient,
 min(waste_reason) as reason
 into v_existing from public.rc_inventory_movements
 where restaurant_id=p_restaurant and
 left(idempotency_key,length(p_idempotency_key)+1)=p_idempotency_key||':'
 if v_existing.quantity is not null then
  if v_existing.quantity<>p_quantity_milli or v_existing.warehouse<>p_warehouse
  or v_existing.ingredient<>p_ingredient
  or v_existing.kind<>case when p_reason is null then 'sale' else 'waste' end
  or v_existing.max_kind<>v_existing.kind or v_existing.reason is distinct from p_reason
  then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return v_existing.cost;
 end if;
 if exists(select 1 from public.rc_inventory_movements where restaurant_id=p_restaurant and idempotency_key=p_idempotency_key)
 then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 -- Serialize FIFO issues for the same ingredient and warehouse to prevent phantom reads.
 perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text||':'||p_warehouse::text||':'||p_ingredient::text,1));
 v_remaining:=p_quantity_milli;
 -- Lock all matching lots in stable FIFO order; updates and movements are one transaction.
 for v_lot in select * from public.rc_inventory_lots
  where restaurant_id=p_restaurant and warehouse_id=p_warehouse
  and ingredient_id=p_ingredient and available_milli>0
  order by received_at,id for update
 loop
  exit when v_remaining=0;
  v_take:=least(v_remaining,v_lot.available_milli);
  v_previous:=v_lot.original_milli-v_lot.available_milli;
  v_cost:=round(((v_previous+v_take)::numeric*v_lot.original_cost_minor)/v_lot.original_milli)
          -round((v_previous::numeric*v_lot.original_cost_minor)/v_lot.original_milli);
  update public.rc_inventory_lots set available_milli=available_milli-v_take where id=v_lot.id;
  v_index:=v_index+1;
  insert into public.rc_inventory_movements
  (restaurant_id,warehouse_id,ingredient_id,lot_id,idempotency_key,movement_type,waste_reason,quantity_milli,cost_minor)
  values(p_restaurant,p_warehouse,p_ingredient,v_lot.id,p_idempotency_key||':'||v_index,
   case when p_reason is null then 'sale' else 'waste' end,p_reason,v_take,v_cost);
  v_total:=v_total+v_cost;
  v_remaining:=v_remaining-v_take;
 end loop;
 if v_remaining>0 then raise exception 'INSUFFICIENT_STOCK'; end if;
 return v_total;
end $$;
revoke all on function public.rc_inventory_receive(uuid,uuid,uuid,bigint,bigint,text,text) from public,anon,authenticated;
revoke all on function public.rc_inventory_issue(uuid,uuid,uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.rc_inventory_receive(uuid,uuid,uuid,bigint,bigint,text,text) to service_role;
grant execute on function public.rc_inventory_issue(uuid,uuid,uuid,bigint,text,text) to service_role;
commit;
