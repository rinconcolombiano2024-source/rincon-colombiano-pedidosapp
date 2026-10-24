-- Requires MIGRACION-V91-75-INVENTORY-PRIVATE-SCHEMA.sql.
-- Owner-only catalog; stock, counts and financial movements remain private.
begin;
alter table public.rc_inventory_ingredients add column if not exists version integer not null default 1 check(version>0);
alter table public.rc_inventory_ingredients add column if not exists default_warehouse_id uuid;
alter table public.rc_inventory_ingredients add constraint rc_inventory_catalog_warehouse_fk foreign key(restaurant_id,default_warehouse_id) references public.rc_inventory_warehouses(restaurant_id,id);
create index rc_inventory_catalog_warehouse_idx on public.rc_inventory_ingredients(restaurant_id,default_warehouse_id);
grant select,insert on public.rc_inventory_ingredients,public.rc_inventory_warehouses to authenticated;
grant update(name,supplier,category,purchase_unit_label,purchase_factor_milli,min_stock_milli,default_warehouse_id,version) on public.rc_inventory_ingredients to authenticated;
grant update(name,active) on public.rc_inventory_warehouses to authenticated;
create policy inventory_catalog_owner_select on public.rc_inventory_ingredients for select to authenticated using (restaurant_id=(select auth.uid()) and (select public.user_has_active_role('restaurant_owner')));
create policy inventory_catalog_owner_insert on public.rc_inventory_ingredients for insert to authenticated with check (restaurant_id=(select auth.uid()) and (select public.user_has_active_role('restaurant_owner')));
create policy inventory_catalog_owner_update on public.rc_inventory_ingredients for update to authenticated using (restaurant_id=(select auth.uid()) and (select public.user_has_active_role('restaurant_owner'))) with check (restaurant_id=(select auth.uid()) and (select public.user_has_active_role('restaurant_owner')));
create policy inventory_warehouse_owner_select on public.rc_inventory_warehouses for select to authenticated using (restaurant_id=(select auth.uid()) and (select public.user_has_active_role('restaurant_owner')));
create policy inventory_warehouse_owner_insert on public.rc_inventory_warehouses for insert to authenticated with check (restaurant_id=(select auth.uid()) and (select public.user_has_active_role('restaurant_owner')));
create policy inventory_warehouse_owner_update on public.rc_inventory_warehouses for update to authenticated using (restaurant_id=(select auth.uid()) and (select public.user_has_active_role('restaurant_owner'))) with check (restaurant_id=(select auth.uid()) and (select public.user_has_active_role('restaurant_owner')));
create function public.rc_inventory_save_ingredient(p_restaurant uuid,p_id uuid,p_expected_version integer,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_warehouse uuid; v_row public.rc_inventory_ingredients%rowtype;
 v_name text:=btrim(p_data->>'name'); v_supplier text:=btrim(p_data->>'supplier');
 v_category text:=btrim(p_data->>'category'); v_unit text:=p_data->>'base_unit';
 v_purchase text:=btrim(p_data->>'purchase_unit_label'); v_location text:=btrim(p_data->>'warehouse');
 v_factor bigint; v_min bigint;
begin
 if v_owner is null or p_restaurant is distinct from v_owner or not public.user_has_active_role('restaurant_owner') then raise exception 'INVENTORY_ACCESS_DENIED'; end if;
 if p_id is null or p_expected_version is null or p_expected_version<0 or jsonb_typeof(p_data) is distinct from 'object'
 or length(coalesce(v_name,'')) not between 1 and 160 or length(coalesce(v_supplier,'')) not between 1 and 160
 or length(coalesce(v_category,'')) not between 1 and 80 or coalesce(v_unit,'') not in ('g','ml','unit')
 or length(coalesce(v_purchase,'')) not between 1 and 100 or length(coalesce(v_location,'')) not between 1 and 120
 or jsonb_typeof(p_data->'purchase_factor_milli') is distinct from 'number'
 or jsonb_typeof(p_data->'min_stock_milli') is distinct from 'number'
 then raise exception 'INVALID_INVENTORY_PRODUCT'; end if;
 if (p_data->>'purchase_factor_milli')::numeric<>trunc((p_data->>'purchase_factor_milli')::numeric)
 or (p_data->>'min_stock_milli')::numeric<>trunc((p_data->>'min_stock_milli')::numeric) then raise exception 'INVALID_INVENTORY_PRECISION'; end if;
 v_factor:=(p_data->>'purchase_factor_milli')::bigint; v_min:=(p_data->>'min_stock_milli')::bigint;
 if v_factor not between 1 and 1000000000000 or v_min not between 0 and 1000000000000 then raise exception 'INVALID_INVENTORY_QUANTITY'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':'||p_id::text,73));
 insert into public.rc_inventory_warehouses(restaurant_id,name) values(v_owner,v_location) on conflict(restaurant_id,name) do nothing;
 select id into v_warehouse from public.rc_inventory_warehouses where restaurant_id=v_owner and name=v_location and active;
 if v_warehouse is null then raise exception 'INACTIVE_WAREHOUSE'; end if;
 select * into v_row from public.rc_inventory_ingredients where restaurant_id=v_owner and id=p_id for update;
 if found then
  if v_row.name=v_name and v_row.supplier=v_supplier and v_row.category=v_category and v_row.base_unit=v_unit
  and v_row.purchase_unit_label=v_purchase and v_row.purchase_factor_milli=v_factor and v_row.min_stock_milli=v_min
  and v_row.default_warehouse_id=v_warehouse then return to_jsonb(v_row); end if;
  if v_row.version<>p_expected_version then raise exception 'INVENTORY_VERSION_CONFLICT'; end if;
  -- A different base unit would reinterpret every historic quantity and recipe.
  if v_row.base_unit<>v_unit then raise exception 'INVENTORY_BASE_UNIT_IMMUTABLE'; end if;
  update public.rc_inventory_ingredients set name=v_name,supplier=v_supplier,category=v_category,
   purchase_unit_label=v_purchase,purchase_factor_milli=v_factor,min_stock_milli=v_min,default_warehouse_id=v_warehouse,version=version+1
   where restaurant_id=v_owner and id=p_id returning * into v_row;
 else
  if p_expected_version<>0 then raise exception 'INVENTORY_VERSION_CONFLICT'; end if;
  insert into public.rc_inventory_ingredients(id,restaurant_id,name,supplier,category,base_unit,purchase_unit_label,purchase_factor_milli,min_stock_milli,default_warehouse_id)
  values(p_id,v_owner,v_name,v_supplier,v_category,v_unit,v_purchase,v_factor,v_min,v_warehouse) returning * into v_row;
 end if;
 return to_jsonb(v_row);
end $$;
revoke all on function public.rc_inventory_save_ingredient(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.rc_inventory_save_ingredient(uuid,uuid,integer,jsonb) to authenticated;
commit;
