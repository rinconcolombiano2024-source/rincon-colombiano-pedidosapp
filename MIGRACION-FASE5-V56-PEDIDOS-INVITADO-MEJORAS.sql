-- Fase 5 / v56
-- Permite que un cliente invitado envie pedidos desde la app cliente.
-- El seguimiento del pedido sigue protegido con public_token.

grant execute on function public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, numeric) to anon;
