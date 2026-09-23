-- Limite autorizado: 30 mensajes/minuto por pedido.
-- Protege el RPC de invitados despues de la validacion V91-12.
-- No altera la firma, el token, el contenido ni los permisos existentes.
begin;
do $migration$
declare
  v_definition text;
  v_anchor text := E'  if v_user_id is null then\n    raise exception ''Order not found'';\n  end if;';
  v_guard text := $guard$

  -- V91-17: serializar mensajes del mismo pedido antes de contar.
  perform 1 from public.customer_orders co where co.id = p_order_id for update;
  if (select count(*) from (
    select 1 from public.customer_order_messages msg
    where msg.order_id = p_order_id
      and msg.created_at > statement_timestamp() - interval '1 minute'
    limit 30
  ) recent_messages) >= 30 then
    raise exception 'Message rate limit exceeded' using errcode = 'PT429';
  end if;
$guard$;
begin
  select pg_get_functiondef('public.create_customer_message(uuid,text,text,text)'::regprocedure)
  into v_definition;
  if strpos(v_definition, '-- V91-17: serializar') > 0 then return; end if;
  if strpos(v_definition, 'rc_ordera_customer_token_matches') = 0
    or strpos(v_definition, v_anchor) = 0 then
    raise exception 'V91-17: contrato V91-12 no reconocido; no se modifico el RPC';
  end if;
  execute replace(v_definition, v_anchor, v_anchor || v_guard);
end;
$migration$;
commit;
