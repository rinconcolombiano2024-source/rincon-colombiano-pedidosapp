# RC ORDERA V6 — pruebas ejecutadas

Fecha2026-10-10. Node24.19.0/npm11.9.0; Chromium153.0.8010.0; Playwright Node1.62.1 y Python1.63.0; PGlite0.5.8. Datos y clientes simulados, sin cobros, impresiones físicas, servicios comerciales ni migraciones de producción. QA-RESULTS.json registra resultados estructurados. Los informes anteriores se conservan explícitamente como históricos.

|Prueba|Resultado|
|---|---|
|V6 recibida, npm ci + npm run qa|344 tests Node aprobados; no prueba suficiente de ausencia de defectos.|
|npm run qa consolidada|370 tests Node,0 fallos/omitidos; incluye fiscal, delivery, readiness, agente, shared, secretos, contabilidad, V5 y hardening.|
|npm run qa:e2e, matriz completa|63 ejecuciones aprobadas:21 escenarios×móvil/tableta/escritorio; Supabase simulado.|
|npm run qa:integration|0 aprobadas,0 fallidas,9 omitidas/bloqueadas por credenciales y fixtures staging;0 TODO.|
|qa:policy|159 archivos JS/TS de sintaxis,45 activos www idénticos y10 identificadores/dependencias de migración. Strip TypeScript no sustituye Deno typecheck.|
|qa:i18n|2324 comprobaciones aprobadas.|
|Python browser-smoke|24 cargas (8 páginas×3 idiomas),10 rutas internas denegadas y2 pruebas CSP;0 fallos.|
|Python browser-menu-vat|18 comprobaciones aprobadas; no usa Supabase real.|
|npm audit, lock completo|0 vulnerabilidades reportadas; no equivale a certificación de seguridad total.|
|Carga/microbenchmark local|V6-PERFORMANCE-RESULTS.json, contra última V5. Presupuestos locales de latencia cumplidos.|
|ZIP limpio|Instalación y repetición de QA, browser e integración registrada en PACKAGE-VERIFICATION.json; no sumar repeticiones como tests nuevos.|

Total informativo:433 ejecuciones Node/E2E aprobadas (370+63);391 casos lógicos si cada escenario E2E se cuenta una sola vez. Las comprobaciones estáticas/Python/carga se presentan aparte, sin inflar ese total.9 pruebas live bloqueadas no se presentan como aprobadas.

## Casos críticos

A:100 solicitudes de cliente usan una petición; ID/token se conservan tras timeout. SQL confirma una venta tras reintentos, precio y pago ya confirmado. B: dos trabajadores lógicos no envían una misma operación; tokens SQL, pérdida de claim, reinicio, leases y tenant probados. C: fiscal UNKNOWN no se reimprime automáticamente; protocolos no verificados siguen bloqueados. D: referencia duplicada y event_id repetido/ausente no concilian; suma exacta, monedas, overflow y reembolsos comprobados. E: RLS y privilegios locales contra SQL ejecutado; Supabase live requiere las nueve pruebas pendientes. F: hashes originales GitHub reconstruidos aplicando deltas reversibles; módulos críticos y funciones previas preservados. G:45 activos www coinciden byte a byte. H: migraciones01..08 intactas,09/10 con hashes/pre/postcondiciones, aplicación SQL y reaplicación idempotente. No certificado de conexiones PostgreSQL independientes.

## Fallos encontrados durante el trabajo

Se detectaron y corrigieron conversión NP=>ZW, inferencia PTU universal, descarte de categoría desconocida, default local retenido ante null remoto, agregación sin identidad/overflow, cuota sin fence global, fallback a v1, cuerpos JSON no acotados/null inválido y envío del enlace QR a tercero. Se restauraron pruebas y validaciones perdidas respecto a última V5. No se borraron pruebas fallidas ni se debilitó seguridad.

El primer test nuevo de migración usó parámetros sin sus nombres originales; PostgreSQL rechazó la preparación de drift y se corrigió la fixture. El primer E2E nuevo intentaba guardar sin renderizar las opciones de categoría; se corrigió la preparación del editor conservando la exigencia de persistencia. El test de caché PWA se actualizó para exigir identidad V6 distinta de V5. La expectativa anterior A=>23 y el fallback v1 se reemplazaron por criterios fiscales/cuota seguros, añadiendo casos negativos; no se alteró un resultado para esconder el defecto. La verificación transversal detectó además que el auditor contable aplicaba un default a snapshots null explícitos; se corrigió y se añadió comprobación SQL→adaptador→cierre, conservando el tratamiento legacy marcado como asumido. Los fallos intermedios están resueltos; resultados finales0 fallos.

## Rendimiento medido

Microbenchmark PGlite local, un proceso; no mide Supabase, dispositivos, Realtime ni CPU del frontend desplegado. Misma carga y esquema efectivo, con última V5fae1e3c como referencia. Cifras crudas reproducibles con scripts/benchmark-v6.mjs --baseline /ruta/checkout/fae1e3c. Motor embebido serializa llamadas.

|Escenario|V5 última p95/CPU|V6 p95/CPU|
|---|---:|---:|
|Cola inactiva50.000 históricos,20 ciclos|2,32ms /56,14ms|1,73ms /46,09ms|
|Pedido60 líneas,menú1000,25 pedidos|11,94ms /289,63ms|12,28ms /250,11ms|
|Cierre2000 ventas,20 cierres|16,78ms /380,60ms|14,57ms /381,19ms|

Cola:40 consultas,0 filas y80 bytes devueltos en ambas versiones. Crecimiento máximo heap50k:6993368→7013856 bytes. CPU de cola (1k/10k/50k), V5→V6: 69.32→77.09ms; 50.63→67.93ms; 56.14→46.09ms. Variabilidad y carga local impiden afirmar mejora global o ausencia estadística de degradación. No se ocultan los resultados. Latencias bajo presupuestos heredados:cola p95<10ms, menú<20ms, cierre<25ms. No se introducen timers/polling ni nuevas suscripciones. QR local evita la petición externa; su coste de CPU frontend completo no se ha medido.

## Bloqueos

Supabase staging con usuarios/fixtures y RLS reales; PostgreSQL nativo con conexiones independientes y EXPLAIN ANALYZE; Stripe/BLIK sandbox oficial; autorización y contratos de plataformas; modelo/protocolo PTU POSNET y hardware; Deno typecheck/despliegue Edge; APK/GPS/múltiples dispositivos; mediciones reales de Realtime/CPU/latencia; auditoría contable de categorías. Google Maps público requiere restricciones administrativas verificadas. CSP default-src/connect-src sigue Report-Only mientras se prueban Maps/Stripe. GitHub remoto403 bloquea rama/PR. Ninguna simulación demuestra producción real. Estado: candidata a staging, no producción certificada.
