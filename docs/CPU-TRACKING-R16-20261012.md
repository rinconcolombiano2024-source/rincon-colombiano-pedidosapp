# RC ORDERA R16 — seguimiento de pedidos y diagnóstico, 12 octubre 2026

## Corrección comprobable

La actualización del seguimiento del cliente reiniciaba su temporizador con cada evento (250 ms). Una ráfaga continua podía aplazar la lectura indefinidamente. Además, la protección de una sola consulta simultánea podía devolver la consulta antigua cuando llegaba un evento durante esa consulta, perdiendo la reconciliación posterior.

R16 agrupa las notificaciones en una ventana fija de 1 segundo. Espera las consultas anteriores, conserva una sola actualización posterior si llegan eventos durante la nueva lectura y descarta trabajo de pedidos, tokens o generaciones anteriores. Un callback de un canal retirado ya no puede pedir datos del nuevo pedido. No modifica escrituras ni autenticación.

El coste visible es hasta 1 segundo de agrupación, más el tiempo de respuesta del servidor. No elimina el coste de decodificación WAL de Realtime. No garantiza ningún porcentaje de CPU o disponibilidad.

Pruebas nuevas: `tests/customer-tracking-coalesce.test.cjs` (22 casos, incluidos 1000 eventos, consulta lenta, rechazo de transporte, cambio de pedido/token, cierre, ocultación y pérdida de red). Se conserva la copia Android `www`. R16 renueva la caché de recursos; no borra pedidos ni almacenamiento local.

## Producción observada por lectura, sin alteraciones SQL

Proyecto: `ouulrehcgmfbettseibn`.
- Estadísticas acumuladas desde 2026-10-03 16:21:40 UTC.
- `realtime.list_changes`: 803081 llamadas y 31039131,69 ms acumulados. El contador permaneció igual entre las muestras de 19:31:39 y 19:34:06 UTC; no se observó una carga activa que permita medir reducción bajo servicio.
- A las 19:31:26 UTC no había filas en `realtime.subscription`.
- Único cron de reparto observado, job 4: inactivo, cada dos minutos. No se activa a ciegas.
- Asesor de rendimiento: índices duplicados, claves externas sin índice y políticas permisivas múltiples. No se eliminan índices ni políticas sin validar su uso y dependencias; no prueban por sí solos el origen del 93% reportado.
- Las Edge Functions de checkout y webhook de pagos están desplegadas. Esto no demuestra credenciales ni cobros, reembolsos o conciliación operativos.
- No aparecen desplegadas `fiscal-agent-gateway` ni `external-delivery-webhook` en la lista obtenida.

## Límites de integraciones

El POS contiene el botón fiscal integrado y pruebas de navegación independiente de cliente/estaciones. Autorizar un puerto USB no implementa POSNET. Hace falta el modelo exacto, protocolo compatible y prueba física con el agente, además de la configuración PTU. Las conexiones de reparto requieren acceso oficial de cada proveedor, identificación del local y pruebas de webhook/estado. No deben presentarse simulaciones como producción.

La PR #5 de protección de rutas es un fundamento no conectado a interfaz, con conflictos con main; no se fusiona mecánicamente como parte de este parche.

## Reversión

Revertir el commit de esta PR y publicar con una nueva versión de caché si surge una regresión. No borrar datos locales ni restaurar indiscriminadamente la base. Validar antes de recargar un POS con pedidos pendientes.
