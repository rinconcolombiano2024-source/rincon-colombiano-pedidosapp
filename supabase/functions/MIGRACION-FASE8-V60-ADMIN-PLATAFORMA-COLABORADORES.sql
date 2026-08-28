-- Fase 8 / v60
-- Administracion de plataforma separada del panel del restaurante.
-- Ejecutar en Supabase SQL Editor despues de la migracion v58.

create or replace function public.platform_owner_email()
returns text
language sql
immutable
as $$
  select 'pedidosapprinconcolombiano@gmail.com'::text;
$$;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users au
    join public.user_roles ur on ur.user_id = au.id
    where au.id = auth.uid()
      and lower(au.email) = lower(public.platform_owner_email())
      and ur.role = 'platform_admin'
      and ur.scope_type = 'platform'
      and ur.status = 'active'
  );
$$;

create or replace function public.user_can_review_couriers()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.is_platform_owner();
$$;

grant execute on function public.platform_owner_email() to authenticated;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.user_can_review_couriers() to authenticated;

-- Convierte el correo oficial en administrador unico de plataforma.
-- No cambies este correo si la plataforma sera administrada por Jhon Jarolt Mendez.
insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
select
  au.id,
  'platform_admin',
  'platform',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'active',
  now()
from auth.users au
where lower(au.email) = lower(public.platform_owner_email())
on conflict (user_id, role, scope_type, scope_id)
do update set status = 'active',
              updated_at = now();

update public.user_roles
set status = 'revoked',
    updated_at = now()
where role = 'platform_admin'
  and user_id not in (
    select au.id
    from auth.users au
    where lower(au.email) = lower(public.platform_owner_email())
  );

-- Nota:
-- La asignacion automatica al colaborador mas cercano requiere una fase aparte:
-- 1. Guardar disponibilidad y ubicacion en tiempo real del colaborador.
-- 2. Calcular distancia contra la direccion del restaurante/pedido.
-- 3. Crear una oferta de entrega para el colaborador mas cercano disponible.
-- 4. Notificar por Realtime/Push y permitir aceptar/rechazar.
