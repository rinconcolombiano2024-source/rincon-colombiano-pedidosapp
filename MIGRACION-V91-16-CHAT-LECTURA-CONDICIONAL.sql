-- Sobrecarga compatible: la firma V91-12 de dos argumentos queda intacta.
-- Versiona metadatos MVCC, no vuelve a leer/serializar imagenes si nada cambio.
begin;
create or replace function public.get_customer_order_messages(
  p_order_id uuid, p_public_token text, p_known_version text
)
returns table(version text, messages jsonb)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_version text;
begin
  if not exists (
    select 1 from public.customer_orders co
    where co.id = p_order_id
      and public.rc_ordera_customer_token_matches(co.id, p_public_token)
  ) then return; end if;

  select md5(coalesce(string_agg(msg.id::text || ':' || msg.xmin::text, ',' order by msg.id), ''))
  into v_version
  from public.customer_order_messages msg where msg.order_id = p_order_id;

  if v_version = p_known_version then
    return query select v_version, null::jsonb;
  else
    return query
    select v_version, coalesce(jsonb_agg(jsonb_build_object(
      'id', msg.id, 'sender', msg.sender, 'body', msg.body,
      'image_data_url', msg.image_data_url, 'created_at', msg.created_at
    ) order by msg.created_at, msg.id), '[]'::jsonb)
    from public.customer_order_messages msg where msg.order_id = p_order_id;
  end if;
end;
$$;
revoke all on function public.get_customer_order_messages(uuid, text, text) from public;
grant execute on function public.get_customer_order_messages(uuid, text, text) to anon, authenticated;
commit;
