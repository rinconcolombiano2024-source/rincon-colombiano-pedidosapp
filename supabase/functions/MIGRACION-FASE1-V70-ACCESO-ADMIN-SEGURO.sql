-- RC ORDERA V70
-- Mantiene el administrador por su user_id y rol platform_admin.
-- No modifica contrasenas, usuarios, pedidos ni datos operativos.

begin;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'platform_admin'
      and ur.scope_type = 'platform'
      and ur.scope_id = '00000000-0000-0000-0000-000000000000'::uuid
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

do $migration$
begin
  if to_regprocedure('public.platform_owner_email()') is not null then
    execute 'revoke all on function public.platform_owner_email() from public';
    execute 'revoke all on function public.platform_owner_email() from anon';
    execute 'revoke all on function public.platform_owner_email() from authenticated';
  end if;
end;
$migration$;

revoke all on function public.is_platform_owner() from public;
revoke all on function public.is_platform_owner() from anon;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.user_can_review_couriers() to authenticated;

commit;

-- Verificacion: debe devolver true solamente al iniciar sesion con el
-- usuario que ya tenga platform_admin activo mediante la migracion V67.
