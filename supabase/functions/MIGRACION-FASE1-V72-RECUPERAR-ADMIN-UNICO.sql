-- RC ORDERA v72 - recuperacion controlada del administrador unico.
-- Confirma solamente la cuenta exacta indicada y activa su rol platform_admin.
-- No cambia ni muestra la contrasena. No crea una cuenta si no existe.

begin;

do $$
declare
  v_count integer;
begin
  if to_regclass('public.user_roles') is null then
    raise exception 'Falta public.user_roles. Ejecuta primero el esquema base.';
  end if;

  select count(*) into v_count
  from auth.users
  where lower(trim(email)) = 'pedidosapprinconcolombiano@gmail.com';

  if v_count = 0 then
    raise exception 'La cuenta administradora no existe en Authentication > Users.';
  elsif v_count > 1 then
    raise exception 'Hay mas de una cuenta administradora con el mismo correo.';
  end if;
end;
$$;

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where lower(trim(email)) = 'pedidosapprinconcolombiano@gmail.com';

update public.user_roles
set status = 'revoked', updated_at = now()
where role = 'platform_admin'
  and user_id <> (
    select id from auth.users
    where lower(trim(email)) = 'pedidosapprinconcolombiano@gmail.com'
    limit 1
  );

insert into public.user_roles (user_id, role, scope_type, scope_id, status, updated_at)
select
  id,
  'platform_admin',
  'platform',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'active',
  now()
from auth.users
where lower(trim(email)) = 'pedidosapprinconcolombiano@gmail.com'
on conflict (user_id, role, scope_type, scope_id)
do update set status = 'active', updated_at = now();

commit;

select
  au.email,
  case when au.email_confirmed_at is null then 'CORREO_SIN_CONFIRMAR' else 'CORREO_CONFIRMADO' end as confirmacion,
  coalesce(ur.status, 'ROL_FALTANTE') as rol_administrador
from auth.users au
left join public.user_roles ur
  on ur.user_id = au.id
 and ur.role = 'platform_admin'
 and ur.scope_type = 'platform'
 and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
where lower(trim(au.email)) = 'pedidosapprinconcolombiano@gmail.com';

