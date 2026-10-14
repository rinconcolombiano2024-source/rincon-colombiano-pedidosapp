# RC ORDERA R24 — sesión, menú y presión de consultas

Base auditada: `8db4045124314c64c31d9f1c83c3573bc9b9aa05` (R23).
Iteración: 14 de octubre de 2026. Cambios de frontend, pruebas y marcador PWA;
sin escrituras de datos, migraciones, cobros ni impresión fiscal en producción.

## P1: respuesta central de una sesión anterior

`refreshCentralCloudState()` podía terminar una lectura después de cambiar de
restaurante, cerrar sesión o sustituir el cliente Supabase. Aplicaba entonces el
menú, pedidos y revisiones antiguos al estado actual. La prueba nueva reprodujo
seis fallos (tres casos en web y Android); los dos casos de sesión válida pasaban.

La función captura la cuenta y el cliente que iniciaron la lectura y los valida
antes de aplicar cualquier respuesta. La renovación del token de la misma cuenta
continúa funcionando; los pedidos locales pendientes se conservan. No se añade
polling ni un reintento. Las ocho pruebas pasan tras la corrección.

## P2: amplificación de errores al cargar el menú público

`customerFetchPublicMenuNow()` ejecutaba dos lecturas adicionales después de un
error de la función RPC, incluso con saturación, límite de solicitudes o falta de
permisos. Esa ruta de compatibilidad podía aumentar la presión precisamente
cuando el servicio estaba fallando.

Ahora los errores que no indican una función ausente se propagan a la recuperación
existente del cargador (incluida la caché local). Se evita pasar de una petición a
tres en esa situación. Se conserva el fallback de versiones antiguas
(`PGRST202`/`42883`), con verificación de restaurante activo y catálogo filtrado por
restaurante. También se conserva el comportamiento previo de una respuesta vacía.

Pruebas: 429, 503, PGRST002, PGRST003, permisos, función ausente, restaurante
inactivo, respuesta vacía y 20 lectores concurrentes compartiendo una petición.
Las pruebas de error fallaron contra la base antes de modificar el cargador.

## Validación local y publicación

- Baseline R23: **753/753** pruebas de `npm run qa`.
- Primera corrección: **761/761**.
- R24: **771/771**, sin fallos ni pruebas omitidas en ese comando.
- La batería incluye sintaxis, ES/PL/EN, sincronización, pagos, fiscal, reparto,
  preservación reversible de fuentes y paridad de distribución web/Android.
- R24 renueva únicamente la caché de archivos estáticos. No borra pedidos,
  localStorage ni IndexedDB. Los controles de versión mantienen su comportamiento.
- CI debe aprobar además auditoría de dependencias y Playwright sobre el commit
  exacto antes de fusionar. Los tests no certifican hardware ni cobros reales.

## Observación de producción, solo lectura

Aproximadamente a las 14:30 UTC, la portada `/` y diez archivos críticos coincidían
byte por byte con R22 (`0f035e694713bf856013c9db9bda0de72910f1b3`). Incluye el acceso
a personal dentro de Restaurante y el puente de ventanas Android. R23 todavía
no coincidía con producción; GitHub registraba rechazo de Vercel por cuota de
despliegues. Una fusión no demuestra que R24 haya sido publicada: ejecutar
`node scripts/verify-production-release.mjs` contra el despliegue final.

Supabase, proyecto RC ORDERA:

- Ventana 14:00–14:20 UTC: 4 entradas de PostgreSQL y 19 del API, sin
  `ORDER_REVISION_CONFLICT` en esa muestra. El tráfico escaso limita la conclusión.
- A las 14:24 UTC: 21 conexiones, 2 activas, incluyendo la consulta de diagnóstico.
- Entre 14:27:12 y 14:28:20 UTC no crecieron los contadores de las consultas de
  pedidos y seguimiento revisadas. La lectura WAL de Realtime aumentó 132 llamadas
  y 849,37 ms acumulados. No se reiniciaron estadísticas ni se hizo una prueba de
  carga en producción.
- Estos contadores **no miden el porcentaje de CPU** ni demuestran una reducción
  desde 93 %. Sigue pendiente correlacionar CPU del host con tráfico real en una
  ventana operativa comparable.
- A las 14:33 UTC: catálogo privado y público idénticos, revisión 40, 42 productos,
  16 con descripción. `menu_updated_at` sigue siendo 2026-08-28. Esto no confirma
  que cambios posteriores en una tableta estén publicados. Conservar el borrador
  original y utilizar «Publicar y verificar menú» / «Comparar Cliente y Caja».

## Integraciones pendientes de puesta en servicio

SumUp: el restaurante mantiene el proveedor online deshabilitado. La tabla
`rc_sumup_payment_attempts`, el RPC de reserva y las Edge Functions de SumUp no
están desplegados en esta comprobación. El código integrado no equivale a cobros
habilitados: faltan despliegue backend, configuración protegida del proveedor y
validación de checkout/webhook/reconciliación.

Fiscal: el botón de conexión está en el panel de restaurante, pero no se verificó
una impresora física ni la emisión real. Reparto externo: existen adaptadores y
pruebas; las autorizaciones, credenciales, mappings y webhooks oficiales de cada
plataforma siguen siendo puertas de aceptación. No declarar estas integraciones
operativas a partir de fixtures o de un botón visible.
