-- Sucesora V91-15/V91-17. Sin backfill, cambios de ACL ni pagos.
-- Idempotente; aborta ante un contrato instalado distinto del ZIP 41.
begin;
do $migration$
declare
  definition text;
  previous text;
  replacement text;
begin
  select replace(pg_get_functiondef('public.rc_ordera_sync_order_station_tasks(uuid)'::regprocedure), E'\r\n', E'\n') into definition;
  previous := 'task.status in (''ready'', ''cancelled'')';
  replacement := 'task.status in (''preparing'', ''ready'', ''cancelled'')';
  if strpos(definition, previous) > 0 then
    definition := replace(definition, previous, replacement);
  elsif strpos(definition, replacement) = 0 then
    raise exception 'V91-19: contrato de estaciones desconocido';
  end if;
  execute definition;

  select replace(pg_get_functiondef('public.create_customer_message(uuid,text,text,text)'::regprocedure), E'\r\n', E'\n') into definition;
  if strpos(definition, '-- V91-19 serialized message limit') = 0 then
    previous := 'and public.rc_ordera_customer_token_matches(co.id, p_public_token);';
    replacement := E'and public.rc_ordera_customer_token_matches(co.id, p_public_token)\n  for update of co;';
    if strpos(definition, previous) = 0 then
      raise exception 'V91-19: contrato de token desconocido';
    end if;
    definition := replace(definition, previous, replacement);
    previous := E'  select count(*)::integer\n    into v_recent_messages\n  from public.customer_order_messages m\n  where m.order_id = p_order_id\n    and m.sender = ''customer''\n    and m.created_at >= now() - interval ''1 minute'';';
    replacement := E'  -- V91-19 serialized message limit\n  -- READ COMMITTED obtiene un snapshot nuevo despues del bloqueo por pedido.\n  if current_setting(''transaction_isolation'') <> ''read committed'' then\n    raise exception ''Retry message in READ COMMITTED'' using errcode = ''40001'';\n  end if;\n  select count(*)::integer into v_recent_messages\n  from (select 1 from public.customer_order_messages m\n    where m.order_id = p_order_id and m.sender = ''customer''\n      and m.created_at >= statement_timestamp() - interval ''1 minute''\n    limit 30) recent;';
    if strpos(definition, previous) = 0 then
      raise exception 'V91-19: contrato de limite desconocido';
    end if;
    definition := replace(definition, previous, replacement);
    execute definition;
  end if;
end;
$migration$;
commit;
