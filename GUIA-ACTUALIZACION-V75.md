# RC ORDERA V75 - estado por horario y autorizaciones

V75 es incremental. No elimina tablas, restaurantes, usuarios, pedidos, menus, documentos ni roles existentes.

## Orden obligatorio

1. Conserva el ZIP de respaldo V74.
2. En Supabase abre **SQL Editor**.
3. Pulsa **New query**.
4. Copia completo `MIGRACION-FASE1-V75-ESTADO-HORARIO-AUTORIZACIONES.sql`.
5. Pulsa **Run** una sola vez y espera `Success`.
6. En otra consulta ejecuta `VALIDACION-V75.sql`.
7. Despliega despues los archivos V75 en Vercel.
8. En la tableta o telefono abre la app, pulsa **Actualizar** y, si conserva una version vieja, cierrala y abrela nuevamente.

La migracion es idempotente: puede ejecutarse nuevamente si una ejecucion se interrumpe. No uses `DROP TABLE` ni borres usuarios para instalarla.

## Estado del restaurante

La pantalla principal del restaurante muestra ahora:

- Estado **Abierto** o **Cerrado**.
- Boton **Abrir atencion** o **Cerrar atencion** en modo manual.
- Opcion **Automatico segun horario**.

Todos los restaurantes existentes permanecen inicialmente en modo manual para conservar su funcionamiento actual.

Para usar el modo automatico:

1. Entra al restaurante.
2. Abre **Editar menu**.
3. Configura cada dia y pulsa **Guardar horario**.
4. Confirma que la zona horaria del restaurante sea correcta.
5. Regresa a la pantalla principal.
6. Activa **Automatico segun horario**.

Supabase calcula el estado con la zona horaria del restaurante. También admite horarios nocturnos, por ejemplo `18:00` a `02:00`.

El directorio del cliente consulta el estado cada 15 segundos y escucha Realtime. La creación del pedido vuelve a comprobar el horario en Supabase, incluso si la app del restaurante no está abierta.

## Autorizar personal del restaurante

1. El propietario abre **Estaciones**.
2. Escribe el mismo correo que usará el empleado.
3. Elige Mesero, Caja, Cocina, Empaque, Despacho o Encargado.
4. Pulsa **Autorizar personal**.
5. Comparte el enlace mostrado con el empleado.
6. El empleado crea o confirma su cuenta desde ese enlace.
7. El propietario pulsa **Confirmar autorizacion**.

La autorización solo se muestra como completada cuando Supabase confirma una membresía activa. V75 corrige también la consulta de la lista para no depender del alias SQL defectuoso `pending`.

La app guarda la invitación; por ahora no envía automáticamente un correo al empleado. El enlace se comparte manualmente.

## Aprobar colaboradores de entrega

1. El colaborador completa su registro y documentos.
2. El administrador entra en `admin.html`.
3. Revisa los documentos.
4. Pulsa **Aprobar para trabajar** o **Rechazar**.
5. V75 comprueba por separado el estado de `courier_profiles` y el rol `platform_courier`.

Una aprobación correcta debe quedar así:

- Perfil: `approved`.
- Rol: `active`.

El colaborador puede pulsar **Actualizar estado** o volver a abrir su app para ver la aprobación.

## Resultado esperado de VALIDACION-V75.sql

- Las cinco pruebas de horario muestran `passed = true`.
- `anon_can_change_mode = false`.
- `anon_can_review_courier = false`.
- Las consultas de inconsistencias de personal y colaboradores devuelven cero filas.
- El directorio público solo muestra restaurantes activos y no eliminados.

## Restaurar la interfaz anterior

Si necesitas volver temporalmente a V74, despliega el ZIP de respaldo `RESPALDO-RC-ORDERA-V74-ANTES-V75-2026-08-09.zip`. La columna y funciones adicionales de V75 son compatibles con V74 y no requieren borrar datos.

