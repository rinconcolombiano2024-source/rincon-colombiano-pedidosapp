# Entrega parcial verificada — productos y cierres

Base exclusiva: RC-ORDERA-HISTORIAL-COMPLETO-20260928.zip. Todos sus archivos se conservan; ninguna migración histórica se modificó. No se desplegó ni se ejecutó SQL en producción.

## Corregido en este bloque

1. POS conserva productId desde el botón de catálogo hasta el ítem vendido. Dos productos con nombre/precio iguales e IDs distintos ya no se fusionan. El ID de línea sigue siendo independiente. Los productos manuales sin ID y las notas conservan su comportamiento.
2. Estadísticas locales y SQL agrupan por identidad de producto. Los ítems antiguos sin ID conservan agrupación por nombre: no se intenta adivinar IDs históricos. El nombre sigue siendo una instantánea legible.
3. close_current_restaurant_period obtiene sus totales, productos, métodos y tipos del mismo get_restaurant_closure_report utilizado en pantalla. Conserva firma, permisos, validación de propietario, formato externo y persistencia existente. El desglose adicional por estación se conserva.
4. Según autorización explícita del usuario, cancelados y rechazados quedan excluidos de ventas. Los filtros locales del cierre siguen la misma regla sin modificar los controles de cancelación/sincronización.
5. Abrir o reimprimir un ticket histórico no lo inserta en savedOrders. Una modificación explícita de su pago sí lo incorpora para conservar el flujo offline/sincronización existente.
6. .vercelignore excluye archivos de desarrollo y base de datos del despliegue estático, sin eliminarlos del ZIP y sin excluir recursos de precaché.
7. Service Worker cambia únicamente el identificador de caché a offline-r4-products-closures. Se conserva la lógica de instalación y recuperación offline.
8. cliente.html raíz/www quedan idénticos; únicamente se elimina la divergencia cosmética.

## Archivos modificados

- app.js / www/app.js: ordersForDay, ordersForMonth, ordersForYear, isExcludedFromClosure; itemReportKey; renderMenu; addItem; evento del menú; loadOrder y evento del historial.
- service-worker.js / www/service-worker.js: línea 1, nueva clave de caché.
- www/cliente.html: igualdad con raíz.

## Archivos nuevos

- MIGRACION-V91-25-PRODUCTOS-Y-CIERRE-UNICO.sql: cambio transaccional, con comprobación de contrato y reejecutable. Aplicar después de V91-24. No reescribe cierres históricos ni pedidos existentes.
- .vercelignore.
- tests/product-identity-closures.test.cjs: identidad POS, agrupación SQL, estados, aislamiento, autorización, reejecución de migración, cierre repetido, filtros locales y recursos de despliegue.
- tests/e2e/product-history-regression.spec.js: interacción POS y apertura histórica en navegador; toda conexión externa bloqueada.
- Este informe.

## Pruebas ejecutadas

- node --check app.js, www/app.js y service-worker.js: aprobado.
- npm run qa: aprobado; 87 tests, cero fallos; 2086 comprobaciones i18n.
- npx playwright test tests/e2e/product-history-regression.spec.js: 1 prueba aprobada en Chrome.
- Prueba SQL con PGlite ejecuta las funciones reales extraídas, V91-24 y V91-25 dos veces. Compara reporte y cierre guardado por día, mes y año, incluyendo productos homónimos, renombrados, sin ID, pedidos rechazados/cancelados y otro restaurante.
- No se ejecutó toda la batería E2E ni integración remota en Supabase; no hay un proyecto TEST configurado. No se afirma ausencia absoluta de regresiones ni certificación de producción.

## Pendientes de la lista original — NO corregidos en este ZIP

- Riesgo de reejecutar V91-22 después de V91-23. No reejecutar V91-22; se conserva intacta por ser histórica.
- Libro visual de cierres históricos guardados.
- Búsqueda/filtros globales sobre todas las páginas del historial (continúan aplicándose a páginas consultadas; fecha sí se filtra en servidor).
- Límite de 100 pedidos del restaurante y listado de 30 del mesero.
- Purga automática de rate-limits y delivery quotes.
- CSP unsafe-inline/unsafe-eval: requiere verificar consumidores externos, mapas y flujos en navegador antes de restringir.
- Gate completo de integración real Supabase: requiere proyecto TEST separado, fixtures y secretos CI; no se suplanta con mocks.

## Activación y cautelas

La parte SQL necesita aplicar V91-25 en un entorno de prueba y posteriormente en el proyecto destino; incluirla en el ZIP no la instala. Sin aplicarla, el servidor sigue usando los cálculos anteriores. Guardar una nueva copia del cierre de un período utiliza la nueva regla; las instantáneas existentes no se recalculan automáticamente. Conservar respaldo y probar un cierre conocido antes de desplegar. La mejora no recupera IDs que ya se perdieron en ventas antiguas.
