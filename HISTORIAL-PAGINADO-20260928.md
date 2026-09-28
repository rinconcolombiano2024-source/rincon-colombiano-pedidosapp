# Corrección exclusiva: historial de tickets limitado a 250

Base: RC-ORDERA-ZIP43-CIERRE-COMPLETO-20260927.zip. Se conserva la corrección anterior del cierre y todos sus archivos.

## Cambios
- app.js y www/app.js, líneas 13155–13312: archivo temporal del historial, paginación bajo demanda de 250 registros con cursor estable por created_at/id, filtro de restaurante y fecha en servidor. Se elimina el límite visual adicional de 500. No cambia la caché operativa de 250 ni las consultas de arranque.
- app.js y www/app.js, alrededor de 14329–14377: actualización y carga de páginas, cancelación al cerrar, acceso a tickets recuperados para las acciones existentes. Solo un ticket seleccionado se incorpora a la colección operativa; consultar páginas no guarda todo el archivo en localStorage.
- offline-i18n.js y www/offline-i18n.js, líneas 3–6: cuatro textos del historial en español, polaco e inglés.
- tests/ticket-history-pagination.test.cjs: siete pruebas nuevas.

## Garantías verificadas
751 tickets accesibles mediante cuatro páginas; sin corte a 250/500; una consulta simultánea; fecha aplicada en servidor; cancelación de consulta obsoleta; respuestas antiguas ignoradas; error 503 sin reintentos automáticos; pedidos locales pendientes preservados; tickets eliminados excluidos; separación del archivo por cuenta; modo offline sin llamadas; igualdad raíz/www.

## Validación
- node --check app.js: aprobado.
- npm run qa: aprobado; 83 tests, 0 fallos; i18n: 2086 comprobaciones.
- No se modificaron SQL, pagos, contratos, Realtime, service worker ni HTML.

## Uso y límites
Abrir Historial completo y usar Cargar mas tickets para consultar anteriores. La fecha consulta directamente ese día en la nube. Búsqueda de texto y filtro de pago se aplican a las páginas consultadas; cargar más incorpora tickets anteriores a esos filtros. Sin conexión permanecen disponibles los tickets locales.

No se ejecutó integración con Supabase remoto ni prueba E2E de navegador. Las pruebas nuevas simulan las respuestas del servidor; no certifican rendimiento de una base productiva concreta. La migración V91-24 incluida pertenece a la reparación anterior del cierre; esta corrección del historial no requiere una migración nueva.
