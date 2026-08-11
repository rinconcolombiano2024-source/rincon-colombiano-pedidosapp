-- RC ORDERA V80 - validacion de solo lectura.
-- Ejecutar despues de MIGRACION-FASE1-V80-CORRECCION-FINAL-V79.sql.

select
  to_regprocedure('public.get_courier_review_queue()') as cola_colaboradores,
  to_regprocedure('public.review_courier_profile(uuid,text)') as aprobar_rechazar,
  to_regprocedure('public.get_my_courier_approval()') as estado_propio,
  to_regprocedure('public.get_courier_review_result(uuid)') as confirmar_revision,
  to_regprocedure('public.submit_waiter_order(uuid,uuid,text,text,text,text,text,jsonb)') as pedido_mesero;

select pg_get_function_result('public.get_courier_review_queue()'::regprocedure) as columnas_cola;

select
  has_function_privilege('anon', 'public.get_courier_review_queue()', 'EXECUTE') as anon_puede_ver_cola,
  has_function_privilege('authenticated', 'public.get_courier_review_queue()', 'EXECUTE') as autenticado_puede_invocar_cola,
  has_function_privilege('anon', 'public.submit_waiter_order(uuid,uuid,text,text,text,text,text,jsonb)', 'EXECUTE') as anon_puede_enviar_mesero,
  has_function_privilege('authenticated', 'public.submit_waiter_order(uuid,uuid,text,text,text,text,text,jsonb)', 'EXECUTE') as autenticado_puede_enviar_mesero;

select
  position(
    'ON CONFLICT ON CONSTRAINT CUSTOMER_ORDERS_PKEY DO NOTHING'
    in upper(pg_get_functiondef('public.submit_waiter_order(uuid,uuid,text,text,text,text,text,jsonb)'::regprocedure))
  ) > 0 as conflicto_mesero_corregido;

select id, name, public
from storage.buckets
where id = 'courier-documents';

select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'Couriers upload own documents',
    'Couriers read own documents',
    'Couriers update own documents',
    'Couriers delete own documents'
  )
order by policyname;

select
  cp.user_id,
  cp.country,
  cp.country_code,
  cp.region,
  cp.city,
  cp.postal_code,
  cp.status as profile_status,
  coalesce(ur.status, '') as role_status,
  cp.reviewed_at
from public.courier_profiles cp
left join public.user_roles ur
  on ur.user_id = cp.user_id
 and ur.role = 'platform_courier'
 and ur.scope_type = 'platform'
 and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
order by cp.updated_at desc;

-- Resultado esperado para un colaborador aprobado:
-- profile_status = approved y role_status = active.
-- El acceso autorizado/no autorizado de la RPC debe probarse desde sesiones reales,
-- porque el SQL Editor no representa el JWT del usuario de la aplicacion.
