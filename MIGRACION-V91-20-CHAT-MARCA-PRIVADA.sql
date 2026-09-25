-- Solo metadatos de invalidacion; no modifica tokens, ACL ni mensajes.
begin;
alter table public.customer_order_access_secrets
  add column if not exists chat_revision uuid;

create or replace function public.rc_ordera_mark_chat_changed()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if TG_OP = 'TRUNCATE' then
    update public.customer_order_access_secrets set chat_revision = gen_random_uuid();
    return null;
  end if;
  if TG_OP = 'UPDATE' and NEW is not distinct from OLD then return null; end if;
  if TG_OP in ('DELETE','UPDATE') then
    update public.customer_order_access_secrets set chat_revision = gen_random_uuid()
    where customer_order_id = OLD.order_id;
  end if;
  if TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and NEW.order_id is distinct from OLD.order_id) then
    update public.customer_order_access_secrets set chat_revision = gen_random_uuid()
    where customer_order_id = NEW.order_id;
  end if;
  return null;
end;
$$;
revoke all on function public.rc_ordera_mark_chat_changed() from public, anon, authenticated;
drop trigger if exists rc_ordera_chat_revision_row on public.customer_order_messages;
create trigger rc_ordera_chat_revision_row after insert or update or delete
on public.customer_order_messages for each row execute function public.rc_ordera_mark_chat_changed();
drop trigger if exists rc_ordera_chat_revision_truncate on public.customer_order_messages;
create trigger rc_ordera_chat_revision_truncate after truncate
on public.customer_order_messages for each statement execute function public.rc_ordera_mark_chat_changed();

create or replace function public.get_customer_order_messages(
  p_order_id uuid, p_public_token text, p_known_version text
)
returns table(version text, messages jsonb)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  v_version text;
begin
  if not exists (
    select 1 from public.customer_orders co where co.id = p_order_id
      and public.rc_ordera_customer_token_matches(co.id, p_public_token)
  ) then return; end if;
  select 'chat-v20:' || coalesce(sec.chat_revision::text, 'initial') into v_version
  from public.customer_order_access_secrets sec where sec.customer_order_id = p_order_id;
  if not found then
    -- Pedidos internos/legados sin boveda conservan el contrato V91-16.
    -- No se crean secretos ficticios ni se bloquea su chat.
    select md5(coalesce(string_agg(msg.id::text || ':' || msg.xmin::text, ',' order by msg.id),''))
    into v_version from public.customer_order_messages msg where msg.order_id = p_order_id;
  end if;
  if v_version = p_known_version then
    return query select v_version, null::jsonb;
  else
    return query select v_version, coalesce(jsonb_agg(jsonb_build_object(
      'id',msg.id,'sender',msg.sender,'body',msg.body,
      'image_data_url',msg.image_data_url,'created_at',msg.created_at
    ) order by msg.created_at,msg.id),'[]'::jsonb)
    from public.customer_order_messages msg where msg.order_id = p_order_id;
  end if;
end;
$$;
-- CREATE OR REPLACE preserva permisos existentes; no se amplian privilegios.
commit;
