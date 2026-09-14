# RC ORDERA — cierre quirúrgico CPU, ZIP (27)

Base: rincon-colombiano-pedidosapp-main (27).zip. El ZIP original no se modificó.
Entrega: 2026-09-14. Alcance exclusivo: solicitudes duplicadas y reintentos que aumentan la carga.

## Archivos de aplicación modificados

- app.js y www/app.js, línea 649: generación del ciclo de respaldo.
- app.js y www/app.js, funciones startClientOrdersPolling (5124) y stopClientOrdersPolling (5161): una respuesta antigua no puede reactivar un ciclo detenido; comprobación después de esperar la consulta; variación aleatoria de la espera dentro de los límites existentes.
- app.js y www/app.js, startClientOrdersRealtime (6011): retirar el canal fallido antes de programar reconexión; sus avisos CLOSED posteriores no reinician el respaldo. Un error no fuerza una consulta inmediata cuando el respaldo ya está en espera creciente.
- app.js y www/app.js, refreshClientOrders (6161): las consultas simultáneas del respaldo comparten la consulta en curso sin exigir otra ronda. Se conserva la reconciliación solicitada por los demás llamadores.
- mesero.js y www/mesero.js, líneas 91 y 97–100: control del ciclo y de la espera entre reintentos.
- mesero.js y www/mesero.js, waiterStationLoadContext (796), waiterScheduleStationRetry (802), waiterDeferStationRetry (816) y waiterLoadStationOrders (825): una sola consulta en curso; espera creciente con variación aleatoria, limitada a 120 segundos, al fallar. Las llamadas durante esa espera no vuelven a consultar Supabase. Se conserva una actualización posterior si llegaron cambios durante la lectura. Los reintentos pertenecen al usuario/restaurante/estación que los originó.
- mesero.js y www/mesero.js, waiterStopStationPolling (1273) y waiterStartStationPolling (1281): invalidar ciclos antiguos; tratar también excepciones de red con espera; no consultar con la página oculta o sin conexión.
- mesero.js y www/mesero.js, waiterStopRealtime (1312) y waiterStartRealtime (1368): invalidar referencias antes de cerrar canales para impedir recursión por CLOSED; cancelar el temporizador pendiente; no reiniciar inmediatamente el respaldo durante una espera por error.

Las copias raíz y www de ambos archivos son idénticas. No se regeneró el resto de www.

## Pruebas añadidas

- tests/cpu-polling.test.cjs: 10 pruebas sobre ciclos detenidos/reiniciados, errores, visibilidad y retirada única de canales fallidos.
- tests/cpu-station-reads.test.cjs: 7 pruebas sobre consultas simultáneas, caché offline, errores 503/red, reconciliación, espera creciente y cambio de estación.

## Resultado de verificación

- node --check: correcto para app.js, mesero.js y sus copias en www.
- node --test tests/*.test.cjs: 32 pruebas correctas (15 existentes y 17 nuevas).
- node qa-i18n-v87.cjs: 2062 comprobaciones correctas.
- npm run qa: NO completamente verde. Antes y después de esta reparación falla únicamente en estas dos comprobaciones preexistentes:
  - checkout reutiliza intentos pendientes sin crear otra sesion pagable
  - checkout recupera una sesion no persistida
- No se alteraron ni omitieron esas comprobaciones. Pagos está fuera del alcance autorizado.
- Las pruebas nuevas reprodujeron los problemas antes de corregirlos. En la simulación de estación con 503, la primera consulta más 100 llamadas adicionales pasaron de 101 RPC a 1 RPC durante la espera. Esto mide solicitudes en una prueba, NO una reducción porcentual de CPU en producción.
- No se ejecutaron pruebas E2E ni integración contra Supabase real en este cierre. Las pruebas ejecutadas no detectaron regresiones; no constituyen una garantía universal de ausencia de errores.

## Alcance y puesta en uso

No se modificaron SQL, RPC, migraciones, permisos, pagos, horarios, menús, tarifas, traducciones, impresión, service worker ni reglas de pedidos. Tampoco se borraron datos locales ni se marcaron pedidos como sincronizados sin confirmación. No se agregaron dependencias.

Este paquete corrige causas demostradas de carga desde el cliente. No certifica que toda causa del 100% de CPU de Supabase haya desaparecido: no se midió el servidor de producción.

Desplegar el proyecto completo mediante el procedimiento habitual. Verificar que los dispositivos reciben estos archivos; no borrar el almacenamiento de la app ni reinstalar dispositivos con pedidos pendientes. Esta entrega no requiere ejecutar SQL adicional. Los informes y SQL históricos se conservaron y no son nuevas instrucciones de esta entrega.
