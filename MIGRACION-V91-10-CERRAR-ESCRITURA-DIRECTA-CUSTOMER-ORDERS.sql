begin;

-- ============================================================
-- RC ORDERA V91-10
-- CERRAR ESCRITURA DIRECTA SOBRE public.customer_orders
--
-- Objetivo:
--   - El restaurante puede LEER sus pedidos.
--   - El cliente puede LEER sus pedidos.
--   - Meseros/estaciones conservan sus politicas SELECT existentes.
--   - Ningun usuario authenticated/anon puede hacer
--     INSERT / UPDATE / DELETE directamente sobre customer_orders.
--   - Toda mutacion debe pasar por RPCs validadas.
-- ============================================================


-- ------------------------------------------------------------
-- 1. RLS debe permanecer habilitado
-- ------------------------------------------------------------

alter table public.customer_orders
enable row level security;


-- ------------------------------------------------------------
-- 2. ELIMINAR LA POLITICA PELIGROSA
--
-- Esta politica antigua era:
--
--   FOR ALL
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id)
--
-- Eso permitia SELECT + INSERT + UPDATE + DELETE.
-- ------------------------------------------------------------

drop policy if exists
  "Users manage own customer orders"
on public.customer_orders;


-- ------------------------------------------------------------
-- 3. ELIMINAR POLITICAS INSERT ANTIGUAS
--
-- Actualmente el alta de pedidos ya debe pasar por
-- create_customer_order(), por lo que estas politicas directas
-- no deben seguir existiendo.
-- ------------------------------------------------------------

drop policy if exists
  "Customers create pending customer orders"
on public.customer_orders;

drop policy if exists
  "Authenticated customers create own pending customer orders"
on public.customer_orders;


-- ------------------------------------------------------------
-- 4. CREAR POLITICA DE SOLO LECTURA PARA RESTAURANTE
--
-- Sustituye el antiguo FOR ALL.
-- ------------------------------------------------------------

drop policy if exists
  "Restaurants read own customer orders"
on public.customer_orders;

create policy
  "Restaurants read own customer orders"
on public.customer_orders
for select
to authenticated
using (
  auth.uid() = user_id
);


-- ------------------------------------------------------------
-- 5. CERRAR ESCRITURA DIRECTA A NIVEL DE PRIVILEGIOS SQL
--
-- Esto es fundamental.
--
-- Aunque apareciera accidentalmente una politica RLS permisiva
-- en el futuro, authenticated y anon seguirian sin tener permiso
-- directo para escribir la tabla.
-- ------------------------------------------------------------

revoke insert, update, delete
on public.customer_orders
from authenticated;

revoke insert, update, delete
on public.customer_orders
from anon;


-- ------------------------------------------------------------
-- 6. CONSERVAR SELECT PARA USUARIOS AUTENTICADOS
--
-- RLS sigue determinando que filas puede leer cada usuario.
-- ------------------------------------------------------------

grant select
on public.customer_orders
to authenticated;


-- ------------------------------------------------------------
-- 7. VERIFICACIONES DEFENSIVAS
--
-- Si por alguna razon UPDATE/DELETE/INSERT siguen concedidos,
-- abortamos la migracion en lugar de dejar una falsa sensacion
-- de seguridad.
-- ------------------------------------------------------------

do $rc_ordera_security_check$
begin

  if has_table_privilege(
    'authenticated',
    'public.customer_orders',
    'INSERT'
  ) then
    raise exception
      'SECURITY ERROR: authenticated conserva INSERT sobre customer_orders';
  end if;


  if has_table_privilege(
    'authenticated',
    'public.customer_orders',
    'UPDATE'
  ) then
    raise exception
      'SECURITY ERROR: authenticated conserva UPDATE sobre customer_orders';
  end if;


  if has_table_privilege(
    'authenticated',
    'public.customer_orders',
    'DELETE'
  ) then
    raise exception
      'SECURITY ERROR: authenticated conserva DELETE sobre customer_orders';
  end if;


  if has_table_privilege(
    'anon',
    'public.customer_orders',
    'INSERT'
  ) then
    raise exception
      'SECURITY ERROR: anon conserva INSERT sobre customer_orders';
  end if;


  if has_table_privilege(
    'anon',
    'public.customer_orders',
    'UPDATE'
  ) then
    raise exception
      'SECURITY ERROR: anon conserva UPDATE sobre customer_orders';
  end if;


  if has_table_privilege(
    'anon',
    'public.customer_orders',
    'DELETE'
  ) then
    raise exception
      'SECURITY ERROR: anon conserva DELETE sobre customer_orders';
  end if;


  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_orders'
      and policyname = 'Users manage own customer orders'
  ) then
    raise exception
      'SECURITY ERROR: la politica peligrosa Users manage own customer orders sigue existiendo';
  end if;


  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_orders'
      and policyname = 'Restaurants read own customer orders'
      and cmd = 'SELECT'
  ) then
    raise exception
      'SECURITY ERROR: falta la politica SELECT del restaurante';
  end if;

end;
$rc_ordera_security_check$;


commit;
