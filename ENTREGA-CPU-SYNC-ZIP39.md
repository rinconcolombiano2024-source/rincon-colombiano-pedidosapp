# Cierre CPU y sincronización — ZIP 39

Base: `rincon-colombiano-pedidosapp-main (39).zip`.
SHA256 original: `D23F5100DDC64EC254C423085603113BCA78AA85514318873F656A800842A5FC`.
No se eliminan archivos originales ni se cambia la versión.

## Cambios de producción

Solo `app.js` y `www/app.js`, con contenido idéntico. Líneas de esta entrega:

| Líneas / funciones | Corrección |
| --- | --- |
| 653, 7250 `refreshClientOrders`, 7331 `performClientOrdersRefresh` | Los lectores concurrentes comparten una operación; solo una petición explícita de reconciliación programa una consulta posterior. Los errores aplican una espera creciente con variación aleatoria, también para llamadas desde foreground/reconexión. Se descartan respuestas de una sesión anterior. |
| 1291 `withCloudTimeout` | Propaga cancelación del llamador a las consultas compatibles, evita iniciar operaciones ya canceladas y retira el listener al finalizar. |
| 799 `refreshRestaurantBusinessContext`, 5291 `claimCloudTicket`, 5304 `setCloudNextTicket`, 5969 `advanceCloudTicketCounter` | Las consultas/RPC reciben la señal real y un tiempo máximo. Una cancelación impide continuar la cadena de solicitudes. No cambia cómo se asignan los tickets. |
| 5319 `saveCloudOrder` | Mantiene la cola serial y una operación por pedido/cuenta. Una edición distinta no puede reutilizar una confirmación ajena. Las operaciones canceladas o de una sesión sustituida no arrancan al salir de la cola. |
| 5376 `saveCloudOrderInternal` | Cancela también las lecturas de reconciliación. Una edición cambiada durante el RPC permanece pendiente; se conserva la revisión realmente confirmada para el siguiente intento. No se fuerza la revisión remota ni se quitan los respaldos/bloqueos existentes. |
| 4470, 7210 `loadCurrentRestaurantDeliveryTracking`, 7331 | Conecta el timeout a las consultas reales de pedidos entrantes y seguimiento, en lugar de limitar solamente la espera externa. |
| 8505 `syncPendingData`, 8541 `schedulePendingDataSyncRetry`, 8651 `runPendingDataSync` | Evita rondas vacías provocadas por llamadas simultáneas, respeta la espera de infraestructura y los 15 segundos entre lotes. Los pedidos añadidos durante una ronda se conservan y generan una única ronda posterior. |
| 12428 `upsertCurrentOrder` | Pasa la señal a la reserva del ticket y a su contador. No modifica impresión ni el guardado local previo a la nube. |
| 7177, 7852, 7868 y 14679 | Conserva la reconciliación explícita requerida tras una reconexión o cuando otra caja ya procesó el pedido. No cambia las acciones de aceptación. |
| 14630 `recoverCloudConnection` | Una recuperación fallida también respeta la ventana existente de deduplicación de foreground. |

`CENTRAL_REALTIME_ENABLED` continúa en `false`. Se conservan los canales, tablas y manejadores de eventos de pedidos entrantes. No se cambian SQL, permisos, pagos, productos, UI, traducciones, service worker ni versiones.

## Pruebas

- `node --check app.js`: correcto.
- `node --check www/app.js`: correcto.
- 33/33 pruebas de CPU/sincronización correctas, sin conectarse a Supabase:
  `node --test tests/cpu-order-sync.test.cjs tests/recovery-load.test.cjs tests/timeout-cancellation.test.cjs tests/sql-dispatch-singleflight.test.cjs`.
- Se añadieron 17 pruebas en `tests/cpu-order-sync.test.cjs`: concurrencia, ediciones, cancelación, conflicto, confirmación perdida, backoff, conservación de pendientes y paridad raíz/www.
- En `tests/recovery-load.test.cjs` se completó el entorno simulado con la bandera de Realtime central y se añadió la prueba del modo desactivado. No se eliminaron ni desactivaron aserciones.
- Cinco pruebas nuevas reproducen fallos en el `app.js` original del ZIP 39 y pasan en esta entrega.

## Límites y pendientes preexistentes

`npm run qa` NO queda completamente verde: antes y después de esta reparación muestra exactamente estos dos fallos de comprobaciones estáticas de `qa-v91.cjs`:

- `mesero conserva pedidos ante fallos temporales de Supabase`.
- `pedido pendiente conserva estado si falla saveCloudOrder`.

Esas comprobaciones buscan formas de texto anteriores (comparación aislada de 503 y llamada directa sin envoltorio de timeout). No se modificó el validador para ocultarlas. El comando se detiene allí; no certifica i18n ni la batería completa. Las pruebas de CPU/sincronización se ejecutaron aparte.

No se ejecutaron E2E ni integración contra la base de datos real. Los controles de concurrencia operan dentro de cada instancia de la app; no son un bloqueo distribuido entre dispositivos. AbortSignal cancela la petición HTTP compatible, pero no demuestra por sí solo que PostgreSQL haya deshecho una escritura ya procesada: por eso permanecen la reconciliación y la confirmación por revisión.

No se midió la CPU de producción; este ZIP no certifica que se haya resuelto toda su saturación. Se conservó sin modificar la divergencia ya existente entre `cliente.js` y `www/cliente.js`, para no reemplazar trabajo ajeno a estas correcciones.
