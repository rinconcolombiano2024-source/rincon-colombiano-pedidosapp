BEGIN;

CREATE OR REPLACE FUNCTION public.create_customer_message(
  p_order_id uuid,
  p_public_token text,
  p_body text,
  p_image_data_url text
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_body text := left(trim(coalesce(p_body, '')), 1200);
  v_image text := coalesce(p_image_data_url, '');
  v_recent_messages integer := 0;
begin
  select co.user_id
    into v_user_id
  from public.customer_orders co
  where co.id = p_order_id
    and public.rc_ordera_customer_token_matches(co.id, p_public_token);

  if v_user_id is null then
    raise exception 'Order not found';
  end if;

  /*
   * V91-17:
   * Protección antiabuso quirúrgica.
   * Máximo 30 mensajes de cliente por pedido en una ventana de 1 minuto.
   */
  select count(*)::integer
    into v_recent_messages
  from public.customer_order_messages m
  where m.order_id = p_order_id
    and m.sender = 'customer'
    and m.created_at >= now() - interval '1 minute';

  if v_recent_messages >= 30 then
    raise exception 'Too many messages. Please try again later.';
  end if;

  if v_image <> '' and v_image not like 'data:image/%' then
    raise exception 'Invalid image';
  end if;

  if length(v_image) > 950000 then
    raise exception 'Image too large';
  end if;

  if v_body = '' and v_image = '' then
    raise exception 'Empty message';
  end if;

  return query
  insert into public.customer_order_messages (
    order_id,
    user_id,
    sender,
    body,
    image_data_url
  )
  values (
    p_order_id,
    v_user_id,
    'customer',
    v_body,
    v_image
  )
  returning public.customer_order_messages.id;
end;
$function$;

COMMIT;
