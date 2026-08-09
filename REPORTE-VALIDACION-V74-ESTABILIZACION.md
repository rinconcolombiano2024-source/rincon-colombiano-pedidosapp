# RC ORDERA V74 - reporte de estabilizacion

Fecha: 09/08/2026

## Causas corregidas

- La aprobacion administrativa mostraba exito antes de confirmar el estado recargado.
- El guardado del perfil del colaborador podia reenviar un estado local antiguo.
- La aprobacion no se actualizaba en el perfil mediante Realtime.
- La autorizacion de estaciones no tenia una confirmacion explicita del propietario.
- La consulta publica de respaldo no excluia deleted_at.
- Un cambio a no-publico puede no generar un evento visible por RLS en un cliente ya abierto.
- La traduccion del menu solo se aplicaba a descripciones.
- Los dialogos tenian desplazamiento anidado y la ventana de personal creaba una segunda columna implicita.
- La ruta offline podia devolver index.html al abrir Cliente, Colaborador, Estacion o Administracion.

## Archivos principales modificados

- MIGRACION-FASE1-V74-ESTABILIZACION-APROBACIONES-UBICACION-ELIMINACION.sql
- app.js
- admin.js
- cliente.js
- colaborador.js
- styles.css
- service-worker.js
- supabase/functions/delete-own-restaurant-account/index.ts
- Los cuatro archivos webmanifest
- cliente.html

## Base de datos

La migracion agrega campos regionales y de revision con ADD COLUMN IF NOT EXISTS, repara las RPC de aprobacion y autorizacion, protege los campos administrativos mediante trigger, prepara la eliminacion publica, agrega Realtime de colaboradores y ejecuta notify pgrst, reload schema.

Es idempotente: puede repetirse. No contiene DROP TABLE, TRUNCATE, borrado de datos ni desactivacion de RLS.

## Seguridad

- Solo un platform_admin global activo puede aprobar/rechazar colaboradores.
- El colaborador no puede autoaprobarse ni alterar datos de revision.
- Las RPC privadas solo conceden ejecucion a authenticated y validan el rol internamente.
- No existe service_role ni clave secreta en HTML o JavaScript publico.
- La configuracion usa la URL base de Supabase, no /rest/v1.
- El restaurante eliminado se marca inactivo antes de intentar borrar Auth.

## Pruebas realizadas

- Sintaxis correcta en ocho archivos JavaScript mediante node --check.
- 20 comprobaciones de navegador aprobadas en Chrome real.
- Cliente, Colaborador, Estacion y Administracion: ancho movil 390 px sin desbordamiento horizontal.
- Traduccion visible de categoria, nombre y descripcion.
- Cierre diario: scrollHeight 2594, clientHeight 760, desplazamiento hasta scrollTop 1834.
- Personal: botones Confirmar autorizacion y Cancelar invitacion visibles en movil y escritorio.
- Sin errores JavaScript de pagina durante las pruebas locales.
- SQL: bloques delimitados balanceados; sin DROP TABLE; sin desactivar RLS; funciones, permisos y recarga de PostgREST presentes.

Las capturas y la prueba reproducible se entregan como qa-v74-*.png y qa-v74.cjs.

## Validacion pendiente en nube

No se afirma que Supabase productivo ya este actualizado: debes ejecutar V74 y volver a desplegar la Edge Function. Despues usa VALIDACION-V74.sql y realiza una aprobacion, una autorizacion y una eliminacion controladas con cuentas de prueba.

