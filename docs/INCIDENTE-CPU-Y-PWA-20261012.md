# RC ORDERA — incidente CPU/revisión y entrega PWA · 2026-10-12

## Evidencias (producción: proyecto Supabase ouulrehcgmfbettseibn)
- Supabase registró **76.192** `ORDER_REVISION_CONFLICT: expected 1, current 2` entre **06:45 y 06:58 UTC**. Error SQLSTATE `40001` en `save_restaurant_order_atomic_strict`, invocado desde `save_and_publish_restaurant_order_atomic`. Es una ventana de logs, **no** una lectura instantánea de CPU.
- Las métricas acumuladas `pg_stat_statements` desde el 03-10 no son tasas por segundo: no permiten atribuir todo el 92 % a una sola consulta, pero los conflictos repetidos son un objetivo prioritario.
- `cron.job` de reparto estaba desactivado; solo había 2 suscripciones Realtime en un muestreo. No deshabilitar RealTime ni reactivar Cron a ciegas.
- La base contiene ventas e historial auténtico; `list_migrations` vacío **no** prueba que no se hayan aplicado scripts SQL manualmente.
- V5-02 y V5-07 contienen protecciones por hash que no coinciden con los procedimientos existentes. **NO quitar los preflights ni ejecutar migraciones masivas sobre producción.**

## Reparación frontend propuesta en PR #4
1. Conserva la detección y backup de conflictos confirmados.
2. Para una revisión rechazada por servidor cuya comprobación remota falla, clasifica el pedido como `revision_unverified`, mantiene el borrador y detiene nuevas escrituras automáticas; no silencia el fallo ni afirma que esté sincronizado.
3. Peticiones abortadas por cancelación permanecen cancelables, sin un falso bloqueo.
4. Pedidos bloqueados conservan `syncStatus=pending` para que no se confundan con ventas confirmadas; el POS muestra «Revisión manual necesaria».
5. Pruebas `tests/cpu-order-sync.test.cjs`: tras un conflicto conocido y error leyendo el remoto, **100 nuevas solicitudes** deben ejecutar **cero** escrituras RPC adicionales.
6. Sincronización PWA: versión de app `91.0.4-nav2` y caché `pwa-safe-r13` (raíz/`www` idénticas).
7. QR y estaciones abren pestañas independientes del POS. Botón fiscal integrado en restaurante solo concede permisos de puerto: no simula un comprobante real ni certifica POSNET.

## Ruta de despliegue seguro
- CI debe pasar: QA estática, pruebas de navegador móvil/tableta/escritorio, ES/PL/EN, verificación `www`, test de revisión y políticas de seguridad.
- Antes de publicar, hacer snapshot/backup verificable y confirmar acceso al POS y restauración local.
- Desplegar frontend después del CI, **sin ejecutar migraciones SQL por este parche**.
- Comprobar en un dispositivo, luego progresivamente en el resto. Recargar solo después de asegurar los pedidos locales pendientes. No borrar caché/datos de usuario indiscriminadamente.
- Si el POS muestra «Revisión manual necesaria», conservar su pedido local, comparar con Supabase, resolver con intervención del encargado. Jamás restablecer ciegamente `_syncRevision` ni sobrescribir la fila remota.
- Medir antes/después por ventana comparable: tasa por minuto de `ORDER_REVISION_CONFLICT`, sesiones activas, `pg_stat_database.xact_rollback`, tasa de solicitudes PostgREST y CPU del panel. El cambio **no garantiza un porcentaje de reducción** sin estas mediciones.
- Si la app tiene regresiones, revertir el despliegue frontend al commit anterior, manteniendo pedidos/diario fiscal; NO revertir la base ni eliminar ediciones locales.

## Fiscal y los diez objetivos
La app **no está certificada para emitir comprobantes fiscales en hardware POSNET**: `fiscal-agent/src/drivers/not-implemented.mjs` declara su controlador pendiente. Para completar el objetivo: modelo POSNET exacto, protocolo del fabricante, agente local autenticado, fiscalización habilitada tras pruebas físicas y mapa PTU validado. Pagos, reparto, cierres contables, seguridad, accesibilidad, idiomas y roles requieren cada uno ensayos de producción/staging específicos; una ejecución de QA de repositorio no equivale a validación total comercial.

Seguimiento: [issue #6](https://github.com/rinconcolombiano2024-source/rincon-colombiano-pedidosapp/issues/6) y [PR #4](https://github.com/rinconcolombiano2024-source/rincon-colombiano-pedidosapp/pull/4).
