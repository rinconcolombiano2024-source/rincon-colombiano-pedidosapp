# Cierre solicitado sobre ZIP21

Se detuvo el trabajo al solicitar el usuario el empaquetado. No se completaron todos los puntos de la solicitud original.

## Reparado

- supabase/functions/marketplace-checkout/index.ts: reutiliza transactionId e idempotency_key de intentos pending sin URL. Conserva intento ante errores ambiguos de proveedor.
- app.js y www/app.js: withCloudTimeout propaga AbortSignal a constructores compatibles, grupos de consultas y funciones que reciben la señal. Las dos lecturas agrupadas de reconciliacion/pendientes ya no pierden la capacidad de cancelacion por convertirse prematuramente en Promise.all.
- ensureMinimumDatabaseVersion transmite la señal a ambos RPC. Abort no garantiza rollback del servidor; se mantienen protecciones de idempotencia.
- recoverCloudConnection no descarga pedidos/clientes cuando los canales siguen suscritos y no hay catch-up pendiente. Sin pendientes no inicia una ronda de escrituras. Un evento offline marca la necesidad de catch-up.
- qa-v91.cjs actualiza exclusivamente la comprobacion de version para exigir la llamada con señal.

## Validacion

Ubicaciones de los cambios (numeracion final):

- app.js y www/app.js: 674-684 y 727-729 (señal en RPC de contrato); 1273-1349 (timeout); 3117 y 3720 (llamadas con señal); 4684-4716 y 7714-7729 (grupos cancelables); 13322-13324 y 13354-13375 (recuperacion).
- supabase/functions/marketplace-checkout/index.ts: 103-111, 132-150, 175-177.
- qa-v91.cjs: 58.
- tests/timeout-cancellation.test.cjs: archivo nuevo.
- ENTREGA-ZIP21-CIERRE.md: archivo nuevo de entrega.

- Sintaxis de app.js y www/app.js aprobada.
- npm run qa aprobado, incluida i18n (2062 comprobaciones).
- Raiz y www/app.js identicos por hash.
- Pruebas locales de cancelacion incluidas. No hubo pruebas reales de Supabase, Stripe ni mediciones de CPU.

## Pendiente, NO reparado en este cierre

- Cancelacion de tareas de estaciones retiradas del pedido (prioridad alta).
- Boton de despacho anticipado y filtrado Realtime de estaciones.
- GPS, resume GPS, polling con jitter, localStorage y revision adicional de timers.
- EXPLAIN real de dispatch e indice: sin acceso a PostgreSQL no se ejecuto ni se invento un indice.

No se modificaron SQL, roles, permisos, carrito, horarios, traducciones, tarifas ni estaciones. No se desplego nada. Debe desplegarse marketplace-checkout en Supabase ademas del frontend. No se certifica ausencia absoluta de regresiones ni eliminacion del 100% de CPU.
