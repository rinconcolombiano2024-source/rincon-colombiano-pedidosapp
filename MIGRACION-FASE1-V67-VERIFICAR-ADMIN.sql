-- RC ORDERA v67
-- Verifica y activa el rol del administrador unico para una cuenta Auth ya existente.
-- No crea funciones, triggers, tablas ni policies.
-- No modifica contrasenas ni confirmaciones de correo.
-- No borra datos.

begin;

do $$
begin
  if to_regclass('public.user_roles') is null then
    raise exception 'Falta public.user_roles. Ejecuta primero el esquema y las migraciones anteriores.';
  end if;
end;
$$;

insert into public.user_roles (
  user_id,
  role,
  scope_type,
  scope_id,
  status,
  updated_at
)
select
  au.id,
  'platform_admin',
  'platform',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'active',
  now()
from auth.users au
where lower(trim(au.email)) = 'pedidosapprinconcolombiano@gmail.com'
on conflict (user_id, role, scope_type, scope_id)
do update set
  status = 'active',
  updated_at = now();

commit;

-- Debe devolver exactamente una fila.
-- No muestra ni modifica la contrasena.
select
  target.email,
  case
    when au.id is null then 'CUENTA_NO_EXISTE'
    else 'CUENTA_EXISTE'
  end as cuenta_auth,
  case
    when au.id is null then 'NO_APLICA'
    when au.email_confirmed_at is null then 'CORREO_SIN_CONFIRMAR'
    else 'CORREO_CONFIRMADO'
  end as confirmacion,
  case
    when au.id is null then 'NO_APLICA'
    when ur.status = 'active' then 'ADMIN_ACTIVO'
    else 'ADMIN_FALTA'
  end as rol_administrador,
  coalesce(au.raw_app_meta_data->>'provider', 'sin_proveedor') as proveedor,
  au.created_at,
  au.last_sign_in_at
from (
  values ('pedidosapprinconcolombiano@gmail.com'::text)
) as target(email)
left join auth.users au
  on lower(trim(au.email)) = target.email
left join public.user_roles ur
  on ur.user_id = au.id
 and ur.role = 'platform_admin'
 and ur.scope_type = 'platform'
 and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid;
