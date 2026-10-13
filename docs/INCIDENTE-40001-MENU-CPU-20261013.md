# RC ORDERA — diagnóstico de carga y protección del guardado del menú
**13 de octubre de 2026; base main d18ae885eac655bfef76525185df92e0f24da80e.**
**Alcance:** cambios exclusivamente de frontend y pruebas; NO se escriben datos de Supabase ni se habilitan pagos.

## Hallazgo verificable en producción

En el proyecto Supabase asociado a RC ORDERA, la consulta agregada de `postgres_logs`
de las últimas 24 horas devolvió **1.153.758** errores
`ORDER_REVISION_CONFLICT: expected 2, current 3`, SQLSTATE `40001`, por PostgREST 14.5.
Distribución UTC: 13:00 (201.747), 14:00 (359.980), 15:00 (359.974),
16:00 (232.057). El último error observado fue a las **16:38:40 UTC**;
no se observó ese mismo patrón en horas posteriores de la ventana consultada.
La tasa de aproximadamente **100 errores/segundo** durante dos horas completas
es una fuente seria de carga y es compatible con un cliente, una prueba o una
automatización que reenvía indefinidamente una revisión obsoleta.

**No se ha identificado inequívocamente el dispositivo o proceso responsable**;
una consulta de PostgreSQL no identifica el User-Agent HTTP de la petición.
No deshabilitar el RPC de producción, no reescribir pedidos y no eliminar
conflictos: existen clientes legítimos y los datos deben conservarse.
Las estadísticas acumulativas de `pg_stat_statements` y
`pg_stat_database` no equivalen a una medición de CPU actual. No se
puede afirmar que la CPU bajó desde 93% sin gráficos del mismo intervalo.

## Menú publicado

Lectura SOLO consulta de `app_settings` y `restaurant_public_catalogs`:
las tres filas de ajustes consultadas tienen publicación pública con la misma
revisión y contenido que su fila privada (revisiones 3, 40 y 1).
La última marca `menu_updated_at` de esas filas es anterior a octubre de 2026.
**Esto no acredita que las descripciones añadidas hoy estén en la nube.**
Pueden estar en el borrador local de un dispositivo; no borrar caché ni sustituir
el catálogo desde otra sesión. En el dispositivo original, usar el botón existente
**Publicar y verificar menú** y luego **Comparar Cliente y Caja**. Si hay varios
perfiles Rincón Colombiano, confirmar qué identificador utiliza el QR/portal.

## Correcciones concretas en esta rama

1. `saveMenuWhenPossible`: deduplica las peticiones concurrentes, agrupa una
   ráfaga de ediciones en un único guardado más como máximo una publicación
   adicional si existen cambios locales pendientes. Nunca repite automáticamente
   un error: un borrador continúa pendiente, sin bucles de escritura.
2. `saveCloudMenu`: captura cliente y cuenta del restaurante. Comprueba que no
   haya cambiado la identidad después de preparar imágenes, recibir el RPC,
   leer una revisión en conflicto y confirmar la publicación. Si cambia,
   rechaza la confirmación, evitando publicar el menú de otra cuenta.
3. Cambios idénticos en `app.js` y `www/app.js` y actualización de hash
   SHA-256 auditado. Sin nuevos intervalos de polling, Edge Functions, SQL,
   permisos públicos, pasarelas de pagos o restauraciones destructivas.
4. Tests de ráfaga de 20 guardados, fallo, cambios durante escritura y cambio
   de restaurante; tests de identidad durante imagen/RPC.

## Puertas de aceptación que NO deben ignorarse

- GitHub QA, Playwright y APK debug son verificaciones automáticas; no prueban el
  flujo operativo de un dispositivo usado en cocina.
- El despliegue de Vercel ya había sido limitado por cuotas de compilación.
  Una fusión en main no prueba que la PWA instalada tenga esta corrección.
  Verificar el SHA desplegado y su Service Worker antes de atribuirle mejoras.
- Supabase SumUp sigue sin Edge Functions y migración de pago habilitadas;
  Stripe, impresión fiscal POSNET y proveedores de reparto requieren pruebas
  oficiales; no activar cobros ni impresión con mocks.
- En el restaurante, conservar el dispositivo que tenga borradores recientes.
  Probar sin dinero real: editar una descripción ES/PL/EN, publicar y confirmar,
  abrir Cliente y Caja en dos dispositivos y verificar la misma cuenta, revisión
  y textos. Una excepción o discrepancia debe dejar el borrador intacto.

## Próximas pruebas de raíz de CPU

Comparar CPU observada del host y latencia en Observability contra las horas
de la tormenta `40001`; identificar la IP/User-Agent en registros del API o
proxy que contengan ese dato; comprobar si es una prueba de carga, cliente
PWA obsoleto o servicio externo. Verificar la ausencia de conflictos repetidos
en una ventana de producción posterior al despliegue. No restablecer contadores
acumulativos sin capturar primero un baseline.
