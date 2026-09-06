-- RC ORDERA V91.07
-- Contrato verificable de compatibilidad para sincronizacion V91.
-- No modifica datos, pedidos, menu, perfiles, RLS ni flujos de negocio.

begin;

create or replace function public.get_rc_ordera_sync_contract()
returns table (
  schema_version integer,
  contract_version integer,
  compatible boolean,
  missing_components text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_missing text[] := array[]::text[];
  v_definition text;
  v_function regprocedure;
begin
  -- V91-02: cancelacion coherente entre customer_orders y orders.
  v_function := to_regprocedure(
    'public.transition_customer_order_status(uuid,text,text)'
  );
  if v_function is null then
    v_missing := array_append(v_missing, 'V91-02.transition_customer_order_status');
  else
    v_definition := lower(pg_get_functiondef(v_function));
    if position('restaurant_order_id' in v_definition) = 0
       or position('canonical_status' in v_definition) = 0 then
      v_missing := array_append(v_missing, 'V91-02.transition_customer_order_status');
    end if;
  end if;

  if to_regprocedure('public.void_restaurant_order(uuid,text)') is null then
    v_missing := array_append(v_missing, 'V91-02.void_restaurant_order');
  end if;

  -- V91-03: contrato multiestacion y publicacion Realtime.
  if to_regprocedure('public.get_my_restaurant_stations(uuid)') is null then
    v_missing := array_append(v_missing, 'V91-03.get_my_restaurant_stations');
  end if;
  if to_regprocedure('public.submit_waiter_order(uuid,uuid,text,text,text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'V91-03.submit_waiter_order');
  end if;
  if to_regprocedure('public.list_my_station_orders(uuid,text)') is null then
    v_missing := array_append(v_missing, 'V91-03.list_my_station_orders');
  end if;
  if to_regprocedure('public.update_my_station_order(uuid,uuid,text,text)') is null then
    v_missing := array_append(v_missing, 'V91-03.update_my_station_order');
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_orders'
  ) then
    v_missing := array_append(v_missing, 'V91-03.customer_orders_realtime');
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'customer_orders'
      and c.relreplident = 'f'
  ) then
    v_missing := array_append(v_missing, 'V91-03.customer_orders_replica_identity');
  end if;

  -- V91-04: revision y guardado/publicacion atomicos.
  if not exists (
    select 1
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'orders'
      and a.attname = 'revision'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    v_missing := array_append(v_missing, 'V91-04.orders_revision');
  end if;
  if to_regprocedure(
    'public.save_and_publish_restaurant_order_atomic(uuid,integer,date,jsonb,numeric,timestamp with time zone,uuid,bigint)'
  ) is null then
    v_missing := array_append(v_missing, 'V91-04.save_and_publish_restaurant_order_atomic');
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'orders'
      and t.tgname = 'rc_ordera_set_order_revision'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) then
    v_missing := array_append(v_missing, 'V91-04.rc_ordera_set_order_revision');
  end if;

  -- V91-05: pedidos POS internos pueden sincronizar con local cerrado.
  v_function := to_regprocedure('public.enforce_customer_order_restaurant_open()');
  if v_function is null then
    v_missing := array_append(v_missing, 'V91-05.enforce_customer_order_restaurant_open');
  else
    v_definition := lower(pg_get_functiondef(v_function));
    if position('new.source' in v_definition) = 0
       or position('new.created_by_user_id = new.user_id' in v_definition) = 0 then
      v_missing := array_append(v_missing, 'V91-05.enforce_customer_order_restaurant_open');
    end if;
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'customer_orders'
      and t.tgname = 'enforce_customer_order_restaurant_open_trigger'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) then
    v_missing := array_append(v_missing, 'V91-05.restaurant_open_trigger');
  end if;

  -- V91-06: elimina la llamada inexistente jsonb_object_length(jsonb).
  v_function := to_regprocedure('public.rc_ordera_sync_order_station_tasks(uuid)');
  if v_function is null then
    v_missing := array_append(v_missing, 'V91-06.rc_ordera_sync_order_station_tasks');
  else
    v_definition := lower(pg_get_functiondef(v_function));
    if position('jsonb_object_length' in v_definition) > 0
       or position('v_groups <> ''{}''::jsonb' in v_definition) = 0 then
      v_missing := array_append(v_missing, 'V91-06.rc_ordera_sync_order_station_tasks');
    end if;
  end if;

  return query
  select
    91,
    6,
    cardinality(v_missing) = 0,
    v_missing;
end;
$$;

revoke all
on function public.get_rc_ordera_sync_contract()
from public, anon;

grant execute
on function public.get_rc_ordera_sync_contract()
to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
