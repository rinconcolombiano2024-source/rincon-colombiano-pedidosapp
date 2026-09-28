# Corrección exclusiva: cierre incompleto por caché de 250 pedidos

Base: `rincon-colombiano-pedidosapp-main (43).zip`. Se conserva cada archivo original.

## Fallo demostrado

El POS limita su caché operativa a 250 pedidos. Los informes disponían de un RPC agregado sin ese límite, pero la interfaz podía volver al cálculo local cuando fallaba la nube y después confirmar/imprimir esos datos parciales. Además, el RPC incluido en V91-01 falla con PostgreSQL 42803: la subconsulta de productos por mes referencia `s.business_date` sin agrupar desde un nivel exterior. La prueba reproduce ese error antes de aplicar la corrección.

## Archivos y cambios

- `app.js` y `www/app.js` (idénticos):
  - 1041: caché de informes separada por cuenta y periodo.
  - 4558: invalida un agregado anterior al refrescar, exige sesión/conexión, transmite AbortSignal al RPC, valida periodo/respuesta y descarta respuestas de una cuenta anterior.
  - 4585: antes de imprimir, usa la sincronización existente una sola vez, verifica que no queden pedidos/borrados pendientes y obtiene el agregado completo. No crea bucles de sincronización.
  - 13307, 13393, 13428: no presenta el cálculo de los últimos 250 como un cierre completo cuando falta el agregado; muestra un aviso y deshabilita imprimir.
  - 13573: no confirma sin conexión ni con pedidos pendientes; no imprime una confirmación que vuelve después de cambiar de cuenta.
  - 13675, 13740, 13775: diario, mensual y anual obtienen de nuevo el informe completo antes de confirmar/imprimir. Conservan plantillas y reglas existentes.
  - eventos de apertura: actualizan el día antes de solicitarlo; los avisos ya no anuncian un cierre local como alternativa válida.
- `offline-i18n.js` y `www/offline-i18n.js` (idénticos), líneas 3–8: traducciones ES/PL/EN de los seis avisos nuevos del mismo arreglo, exigidas por QA. Ningún texto previo cambiado.
- `MIGRACION-V91-24-CIERRE-COMPLETO.sql` (nuevo): cambia solo la expresión de cantidad por mes del RPC existente; usa la clave de mes ya agrupada. Transaccional, idempotente y con comprobación de la definición esperada. Conserva firma, permisos, filtros y todos los pedidos. No modifica migraciones históricas ni datos.
- `tests/closure-completeness.test.cjs` (nuevo): 15 pruebas específicas, incluyendo PostgreSQL local y la ruta de impresión real extraída de app.js.
- Este informe (nuevo).

## Verificación

- Referencia antes del arreglo: `npm run qa`, 61 pruebas aprobadas.
- Después: `npm run qa`, **76 aprobadas, cero fallos**. QA estático aprobado; i18n **2078 comprobaciones aprobadas**.
- `node --check` aprobado en app.js, www/app.js, offline-i18n.js y www/offline-i18n.js.
- 351 ventas de 10 cada una, 702 productos, un pedido anulado adicional y otro restaurante con una venta de 999: el RPC devuelve 351 ventas/3510 y excluye correctamente el anulado y la otra cuenta. Se pasa esa respuesta SQL real al flujo de impresión diario, mensual y anual manteniendo solo 250 pedidos en memoria.
- Comprueba periodo vacío, otra cuenta, falta de autenticación, error de nube, offline, pedidos pendientes, respuesta tardía, datos malformados e idempotencia de la migración.
- SQL probado en PGlite/PostgreSQL local. **No se ha aplicado a Supabase productivo ni certificado integración contra ese proyecto.** No se ejecutó navegador E2E general en este cambio limitado; las pruebas nuevas cubren funciones del cierre, no impresora física.

## Instalación necesaria

1. Conservar respaldo del proyecto/BD y probar primero en un entorno de prueba si está disponible.
2. Ejecutar **solo la nueva migración `MIGRACION-V91-24-CIERRE-COMPLETO.sql`**, después de las migraciones ya utilizadas. No volver a ejecutar todas las históricas. Si detecta una definición diferente, aborta sin modificarla; no forzarla.
3. Publicar los archivos actualizados, incluidas sus copias `www`, y comprobar que el dispositivo carga la actualización.
4. Comprobar un cierre conocido contra las ventas de la base de datos antes de usarlo operativamente.

Sin aplicar la migración, la interfaz bloqueará el informe incompleto en vez de imprimir la caché de 250. Sin conexión o con pendientes, se conserva la toma de pedidos/offline existente, pero no se confirma ni imprime un cierre que no puede verificarse completo.

## Límites del alcance

La caché operativa sigue en 250. No se descargan todos los pedidos ni se aumenta polling. No se tocan pagos, tokens, carrito, estaciones, menú, Realtime, contratos financieros ni otros hallazgos. No se cambia la definición de qué ventas incluye el agregado ni se concilian diferencias preexistentes entre distintos reportes. Un cierre con ventas nuevas concurrentes desde otros dispositivos mantiene la semántica existente de los RPC; no se ha introducido un bloqueo global del restaurante.

No se garantiza ausencia absoluta de regresiones: las pruebas anteriores y las específicas pasan, con las limitaciones de entorno declaradas.
