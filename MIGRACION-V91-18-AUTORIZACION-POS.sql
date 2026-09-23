-- Solo autorizacion y aislamiento del POS. No cambia importes ni procesos financieros.
-- El personal mantiene sus RPCs existentes con validacion de membresia.
begin;
do $migration$
declare
  v_signature text;
  v_definition text;
  v_anchor text;
  v_actor text;
  v_guard text := $guard$

  -- V91-18: POS del propietario, tambien cuando el local esta cerrado al publico.
  if not exists (
    select 1 from public.restaurant_profiles rp
    where rp.user_id = auth.uid() and rp.active = true and rp.deleted_at is null
  ) then
    raise exception 'Restaurant is not authorized' using errcode = '42501';
  end if;
$guard$;
begin
  foreach v_signature in array array[
    'public.save_and_publish_restaurant_order_atomic(uuid,integer,date,jsonb,numeric,timestamptz,uuid,bigint)',
    'public.publish_current_restaurant_order_to_stations(uuid,uuid)'
  ] loop
    select pg_get_functiondef(v_signature::regprocedure) into v_definition;
    if strpos(v_definition, '-- V91-18: POS') = 0 then
      v_actor := case when strpos(v_signature, 'save_and_publish') > 0 then 'v_actor' else 'v_owner_id' end;
      v_anchor := substring(v_definition from
        ('if ' || v_actor || ' is null then[[:space:]]+raise exception ''Not authenticated'';[[:space:]]+end if;'));
      if v_anchor is null then
        raise exception 'V91-18: contrato no reconocido para %', v_signature;
      end if;
      v_definition := replace(v_definition, v_anchor, v_anchor || v_guard);
    end if;

    if strpos(v_signature, 'publish_current') > 0
      and strpos(v_definition, 'where customer_orders.user_id = v_owner_id') = 0 then
      v_anchor := E'          restaurant_order_id = excluded.restaurant_order_id, updated_at = now()\n      returning customer_orders.id into v_customer_order_id;';
      if strpos(v_definition, v_anchor) = 0 then
        raise exception 'V91-18: publicacion no reconocida; no se modifico el contrato';
      end if;
      v_definition := replace(v_definition, v_anchor,
        replace(v_anchor, '      returning customer_orders.id',
          E'      where customer_orders.user_id = v_owner_id\n      returning customer_orders.id'));
    end if;
    execute v_definition;
  end loop;
end;
$migration$;
commit;
