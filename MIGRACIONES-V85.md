# Migraciones RC ORDERA V85

Estas migraciones son incrementales. No usan `DROP TABLE`, `TRUNCATE`, borrado
masivo ni desactivan RLS. Deben ejecutarse sobre una base que ya contiene el
nucleo V82, entregas V83, experiencia V84 y estabilizacion V84.1.

## Respaldo previo

Desde Supabase crea un respaldo del proyecto o confirma que Point in Time
Recovery/backup esta disponible. No pruebes primero en produccion: usa un proyecto
de staging con una copia anonimizada.

## Orden obligatorio

1. `MIGRACION-V85-01-PROTEGER-MENU-Y-AJUSTES.sql`
   Agrega revisiones independientes, respaldos y RPC seguras del menu.
2. `MIGRACION-V85-02-ESTACIONES-TURNOS-CIERRES.sql`
   Agrega estaciones, tareas, jornadas y cierres internos.
3. `MIGRACION-V85-03-PAGOS-MARKETPLACE.sql`
   Agrega cuentas de pago, asignaciones, confirmaciones y auditoria de eventos.
4. `VALIDACION-V85.sql`
   Comprueba objetos, RLS, permisos y porcentajes sin cambiar datos.

Pega cada archivo completo en una consulta nueva de SQL Editor y ejecutalo solo
una vez, respetando el orden. Aunque las migraciones admiten repeticion controlada,
el historial de produccion debe registrar fecha, archivo y resultado.

## Resultado esperado

`VALIDACION-V85.sql` debe terminar con:

```text
RC ORDERA V85 STRUCTURE OK
```

Ademas debe mostrar `restaurant_fee_bps = 500`, `courier_fee_bps = 10`, RLS
activo y ejecucion de las funciones financieras sensibles reservada a
`service_role`.

## Realtime

Las tablas existentes `app_settings`, `customer_orders`, `delivery_assignments`
y `notifications` deben permanecer en la publicacion Realtime utilizada por la
aplicacion. No agregues tablas financieras a lectura publica.

## Si falla una migracion

Detente. Conserva el mensaje completo, el numero de linea y el resultado de:

```sql
select version();
select current_user;
```

No ejecutes scripts antiguos encima para ocultar el error y no borres tablas.
Revisa `ROLLBACK-V85.md`.
