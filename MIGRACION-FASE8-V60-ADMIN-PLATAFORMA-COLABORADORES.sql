-- Fase 8 / v60
-- Administracion de plataforma separada del panel del restaurante.
-- Ejecutar en Supabase SQL Editor despues de la migracion v58.

create or replace function public.user_can_review_couriers()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.user_has_active_role('platform_admin');
$$;

grant execute on function public.user_can_review_couriers() to authenticated;

-- Convierte este correo en administrador de plataforma.
-- Si usas otro correo para iniciar sesion como dueno de la plataforma,
-- cambia pedidosapprinconcolombiano@gmail.com por tu correo real.
insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
select
  au.id,
  'platform_admin',
  'platform',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'active',
  now()
from auth.users au
where lower(au.email) = lower('pedidosapprinconcolombiano@gmail.com')
on conflict (user_id, role, scope_type, scope_id)
do update set status = 'active',
              updated_at = now();

-- Nota:
-- La asignacion automatica al colaborador mas cercano requiere una fase aparte:
-- 1. Guardar disponibilidad y ubicacion en tiempo real del colaborador.
-- 2. Calcular distancia contra la direccion del restaurante/pedido.
-- 3. Crear una oferta de entrega para el colaborador mas cercano disponible.
-- 4. Notificar por Realtime/Push y permitir aceptar/rechazar.
