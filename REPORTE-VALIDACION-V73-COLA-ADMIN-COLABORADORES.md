# RC ORDERA V73 - reparacion de la cola administrativa de colaboradores

Fecha: 02/08/2026

## Causa exacta

El panel `admin.js` llama correctamente a `get_courier_review_queue()` sin parametros. La definicion historica de esa RPC existe en la migracion V58 y en `supabase-schema.sql`, pero no existe en el esquema publicado que atiende PostgREST. Por eso la API devuelve `PGRST202` y HTTP 404.

Las migraciones administrativas posteriores V60, V62 y V70 recrearon la comprobacion `is_platform_owner()`, pero no recrearon la cola ni la funcion de revision. El inicio de sesion y el rol administrativo pueden funcionar mientras la cola sigue ausente.

## Contrato confirmado en el codigo

- Lista: `public.get_courier_review_queue()` sin parametros.
- Revision: `public.review_courier_profile(p_user_id uuid, p_status text)`.
- Estados usados por el panel: `approved` y `rejected`.
- Tabla de perfiles: `public.courier_profiles`.
- Tabla de roles: `public.user_roles`.
- Archivos: bucket privado `courier-documents`.
- No existe una tabla separada `courier_documents`: las referencias se guardan en columnas de `courier_profiles`.

La cola devuelve exactamente estas 25 columnas:

`user_id`, `email`, `first_name`, `last_name`, `phone`, `birth_date`, `country`, `city`, `address`, `identity_document`, `identity_document_url`, `photo_url`, `verification_selfie_url`, `work_permit_url`, `vehicle_type`, `vehicle_plate`, `driver_license`, `driver_license_url`, `insurance_info`, `insurance_url`, `bank_account`, `availability`, `status`, `created_at`, `updated_at`.

## Archivos modificados

- `MIGRACION-V73-REPARAR-COLA-REVISION-COLABORADORES.sql`: crea o repara las dos RPC y sus permisos.
- `admin.js`: mensajes claros para migracion ausente, permiso denegado y errores de revision; bloqueo contra doble clic.
- `service-worker.js`: cache cambiado a `rc-ordera-v73-admin-review`.
- `MEMORIA_APP_RINCON_COLOMBIANO.txt`: registro de la correccion.

No se modificaron restaurante, cliente, pedidos, menu, precios, tickets ni suscripciones Realtime.

## Seguridad aplicada

- Ambas RPC comprueban `auth.uid()`.
- Ambas exigen `platform_admin`, ambito `platform`, UUID global cero y estado `active`.
- `SECURITY DEFINER` se usa porque la cola necesita leer `auth.users` y la revision actualiza otro perfil.
- `search_path` queda fijado en `pg_catalog, public`.
- `anon` y `PUBLIC` no reciben ejecucion.
- Solo `authenticated` recibe `GRANT EXECUTE`; tener el permiso de llamada no evita la comprobacion interna del rol.
- No se usa ni expone `service_role`.
- No se desactiva RLS.
- La actualizacion del perfil y del rol ocurre en la misma transaccion de la RPC.
- La migracion no modifica contrasenas, usuarios ni el administrador existente.

## Orden de ejecucion

1. Abre Supabase y selecciona el proyecto usado por Vercel.
2. Entra en `SQL Editor` y crea una consulta nueva.
3. Copia todo `MIGRACION-V73-REPARAR-COLA-REVISION-COLABORADORES.sql`.
4. Pulsa `Run`.
5. Debe mostrar `Success. No rows returned`.
6. Cierra y vuelve a abrir `/admin.html`, o pulsa `Actualizar`.
7. Despliega despues el contenido del ZIP V73 en Vercel.

La migracion ejecuta `notify pgrst, 'reload schema';`; no es necesario reiniciar Supabase.

## Consultas de validacion

### Funciones y permisos

```sql
select
  to_regprocedure('public.get_courier_review_queue()') as queue_rpc,
  to_regprocedure('public.review_courier_profile(uuid,text)') as review_rpc;

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('get_courier_review_queue', 'review_courier_profile')
order by routine_name, grantee;
```

Las dos funciones deben aparecer. `authenticated` debe tener `EXECUTE`; `anon` no debe aparecer.

### Identificadores para las pruebas

Ejecuta primero como propietario del proyecto y conserva los UUID devueltos:

```sql
select id, email
from auth.users
where lower(email) = 'pedidosapprinconcolombiano@gmail.com';

select cp.user_id, au.email, cp.status
from public.courier_profiles cp
left join auth.users au on au.id = cp.user_id
order by cp.updated_at desc;
```

### Administrador autorizado

Sustituye `UUID_ADMIN` por el UUID real:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'UUID_ADMIN', true);
select * from public.get_courier_review_queue();
rollback;
```

Debe devolver filas o una lista vacia, nunca `PGRST202`.

### Usuario autenticado sin rol

Sustituye `UUID_USUARIO_NORMAL`:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'UUID_USUARIO_NORMAL', true);
select * from public.get_courier_review_queue();
rollback;
```

Debe fallar con codigo SQL `42501` y mensaje de acceso no autorizado.

### Usuario anonimo

```sql
begin;
set local role anon;
select * from public.get_courier_review_queue();
rollback;
```

Debe fallar por falta de permiso de ejecucion.

### Cola vacia o colaboradores pendientes

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'UUID_ADMIN', true);
select count(*) as total_cola from public.get_courier_review_queue();
select * from public.get_courier_review_queue() where status = 'pending_review';
rollback;
```

`total_cola = 0` es una respuesta valida cuando no existen perfiles. Un perfil `pending_review` debe aparecer en la segunda consulta.

### Aprobar y rechazar sin conservar cambios de prueba

Sustituye `UUID_COLABORADOR_PRUEBA`:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'UUID_ADMIN', true);

select public.review_courier_profile('UUID_COLABORADOR_PRUEBA'::uuid, 'approved');
select status from public.courier_profiles where user_id = 'UUID_COLABORADOR_PRUEBA'::uuid;
select status from public.user_roles
where user_id = 'UUID_COLABORADOR_PRUEBA'::uuid
  and role = 'platform_courier';

select public.review_courier_profile('UUID_COLABORADOR_PRUEBA'::uuid, 'rejected');
select status from public.courier_profiles where user_id = 'UUID_COLABORADOR_PRUEBA'::uuid;
select status from public.user_roles
where user_id = 'UUID_COLABORADOR_PRUEBA'::uuid
  and role = 'platform_courier';

rollback;
```

La aprobacion debe producir `approved` y rol `active`; el rechazo debe producir `rejected` y rol `revoked`. `rollback` evita conservar esta prueba.

## Validacion local realizada

- Contrato de 25 columnas comparado con los campos que renderiza `admin.js`: correcto.
- Nombres y parametros de las dos RPC comparados con el frontend: correctos.
- Sintaxis JavaScript: correcta.
- Migracion sin `DROP TABLE`, `DELETE` ni `TRUNCATE`: correcta.
- `notify pgrst, 'reload schema'`: presente.
- Autocomprobacion de funciones y privilegios incluida dentro de la migracion.

La ejecucion real contra Supabase debe realizarse con la migracion anterior. Hasta ese momento no se declara validado el comportamiento de nube.

