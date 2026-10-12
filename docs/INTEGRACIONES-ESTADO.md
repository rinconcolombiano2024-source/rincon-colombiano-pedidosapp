# Contratos y bloqueos externos V5

El registro productivo `createDefaultDeliveryRegistry` queda vacío hasta que se registre un adaptador revisado. Las cinco plantillas de V4 se conservan en `createPreparedDeliveryRegistry`, con identificadores canónicos `uber_eats`, `wolt`, `glovo`, `bolt_food`, `pyszne`; los alias históricos se normalizan únicamente allí. Sus fixtures son supuestos, no pruebas oficiales.

`DeliveryOutbox` exige store durable y restaurante en uso productivo. `PostgresOutboxStore` usa consultas parametrizadas, reclamación atómica, token de propietario, journal de eventos y recuperación de workers expirados a UNKNOWN. No existe cron automático. Reconciliar exige evidencia explícita. Una respuesta de red perdida o HTTP409 no demuestra envío correcto. Reintentos de respuestas transitorias solo para adaptadores cuyo contrato revisado declare `safeRetries` o en simulación con fetch inyectado.

La cola no se conecta todavía a los proveedores reales ni reemplaza el inbox de GitHub. La traducción canónico/inbox y callbacks de cocina requiere fixtures oficiales por plataforma y prueba de staging. No agregar un proveedor a la lista de readiness como conectado por contar con una plantilla.

`FiscalService` y su registro conservan la validación fuerte de GitHub. El CLI fiscal permite exclusivamente `mock`; el gateway requiere `RC_FISCAL_AGENT_ENABLED=test`, dispositivo test y `driver_id=mock`. El template NoviAPI solo puede construirse con `simulationOnly=true` y un fetch inyectado distinto del fetch global. POSNET y Elzab fallan cerrado por falta de implementación verificable.

Estados del contrato: PENDING = pending; PROCESSING = claimed/sending; CONFIRMED = confirmed; FAILED = failed; UNKNOWN = unknown. No renombrar retrospectivamente los estados del esquema. Claims y envío conservan V91-35; la nueva migración añade resultado reportable e idempotente. UNKNOWN mantiene bloqueado el dispositivo y no se devuelve a pending.

El modelo exacto POSNET, firmware, interfaz USB/COM/TCP/IP, tabla PTU del dispositivo y documentación oficial son los insumos de la siguiente validación. RC ORDERA comunica con la impresora autorizada; no implementa una caja fiscal.

Referencias consultadas el 10-10-2026:
- https://www.posnet.com.pl/--drukarki-fiskalne
- https://dokumentacja.posnet.com/thermal-xl-2-online/
- https://developer.wolt.com/docs/getting-started/restaurant
- https://developer.wolt.com/docs/api/order
- https://developer.wolt.com/docs/webhook
- https://docs.stripe.com/api/idempotent_requests

No se implementaron comandos ni endpoints nuevos a partir de una suposición. Las rutas heredadas de V4 son descriptores provisionales y quedan fuera de todo envío productivo.

## Contrato actual de cola

El store debe implementar due(now,limit,blockedProviders), list({limit,afterId,states}) y recover(now,limit). list ya no devuelve historial completo; límites1–500. ready solo se reclama cuando accept de la misma orden/proveedor/restaurante está sent. Recovery usa candidatos MATERIALIZED con SKIP LOCKED y lease/token; UNKNOWN no sale automáticamente. El timestamp de lease se obtiene para cada comando secuencial. No hay scheduler nuevo ni conexión oficial activada.
