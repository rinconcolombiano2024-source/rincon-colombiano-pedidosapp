# QA — entrega production-hardening

Base V5 b901125:292 casos Node verdes. Esta entrega:339 casos Node verdes, incluidos46 nuevos de hardening y un nuevo caso dispatch. Resultado final npm run qa: exit0,339 pass,0 fail,0 skip,0 TODO. Los comandos fiscal/delivery/readiness/accounting/v5/hardening están dentro de qa y no se cuentan de nuevo.

|Verificación|Resultado y alcance|
|---|---|
|npm ci|Instalación local y repetición desde paquete limpio; ver PACKAGE-VERIFICATION.json. Sin scripts lifecycle.|
|npm run qa|339/339; SQL real PGlite, mocks de transporte y handlers Edge inyectados; no backend desplegado.|
|qa:fiscal / qa:fiscal-agent|Incluidos en339; UNKNOWN, respuestas perdidas, claims, journal y mock no fiscal.|
|qa:delivery|Incluido; concurrencia lógica, claims, tokens, backoff y proveedores cerrados.|
|qa:readiness|Incluido; ninguna plantilla implica conexión oficial.|
|qa:e2e|17 escenarios × móvil/tableta/escritorio =51 aprobados, Chromium153 real, fixtures locales.|
|i18n|2302 comprobaciones;74 textos nuevos del centro en ES/PL/EN.|
|Sintaxis/política|144 archivos JS/TS; TS se borra con stripTypeScriptTypes y se comprueba sintaxis resultante. No es typecheck Deno.|
|www|42 assets idénticos a fuentes; regeneración controlada.|
|Migraciones|7 V5 con dependencias e IDs únicos;4 incrementales nuevas, pre/postcondiciones y hashes RPC. SQL anterior inmutable.|
|Dependencias|npm audit incluyendo dev:0 vulnerabilidades reportadas en la consulta; no garantiza ausencia de vulnerabilidades desconocidas.|
|Secretos|Escáner pasa; clave Maps pública heredada requiere revisar restricciones externas. No secretos privados añadidos.|
|qa:integration|0 pass,0 fail,9 SKIP por falta de fixtures/credenciales staging;0 TODO. Mutación implementada pero no aprobada sin staging.|
|qa:browser Python|Suite auxiliar bloqueada: módulo Python playwright ausente; E2E Node real sí ejecutado.|
|PostgreSQL nativo|No ejecutado: initdb no permite root y el entorno niega cambio de grupo. PGlite serializa queries; falta varias conexiones reales.|
|Supabase/Stripe/hardware/proveedores|No ejecutados contra entornos oficiales ni dispositivos. Requieren acceso y autorización controlada.|
|APK / Deno / deploy|No se compiló APK, no typecheck Deno ni deployment productivo.|

## Regresiones y fallos resueltos durante el trabajo

Se conservan todos los casos anteriores, incluido el que reproduce el error histórico dispatch42702; se añade una prueba de la corrección incremental. Recovery limitada con subquery reevaluada recuperó6 filas pese a LIMIT2: se corrigió con candidatos MATERIALIZED y se exige2. El primer check TS con node --check no borraba tipos: se corrigió el validador, sin excluir TS. Una prueba inicial de CSP usó CDP evaluate, que puede saltarse CSP; se sustituyó por ejecución en un documento servido con headers reales, manteniendo el criterio de bloqueo. Las descargas estándar de Chromium fallaron, pero se obtuvo un Chromium funcional por tooling independiente y se ejecutó la matriz completa. Ningún fallo de producto se ocultó ni se borraron tests.

Dos expectativas legacy de contador skipped en outbox se adaptaron al nuevo filtro SQL: filas futuras/bloqueadas ya no se visitan; las pruebas siguen exigiendo cero envíos y conservación pending/backoff. El contrato de stats cuenta candidatos visitados, no el historial completo.

## Rendimiento medido

PERFORMANCE-RESULTS.json contiene cifras crudas; scripts/benchmark-hardening.mjs reproduce ambas implementaciones contra V5. Node24.19.0, PGlite local, sin red, 20 ciclos/cierres o25 pedidos. Es un microbenchmark, no una medición de Supabase ni del frontend de producción. CPU suma tiempo de proceso; memoria es máximo crecimiento heap observado, no RSS aislado del motor.

|Escenario|V5 p95|Hardening p95|
|---|---:|---:|
|Cola inactiva,50.000 históricos,20 ciclos|494,72 ms|2,18 ms|
|Pedido60 líneas,menú1000 productos|42,32 ms|9,76 ms|
|Cierre2000 ventas|118,44 ms|17,18 ms|

Cola:40 consultas en ambos casos; filas devueltas1.000.000→0; payload396.777.940→80 bytes; CPU11929→56 ms; crecimiento heap90.526.568→6.844.376 bytes. No se afirma menor número de consultas. Escenarios con pendientes futuros masivos, backlog caliente, locks reales y concurrencia multidevice requieren EXPLAIN ANALYZE/carga en staging.

Presupuestos provisionales para repetir en el mismo entorno: cola inactiva50k p95<10ms, lote<=100; cierre2000 p95<25ms; menú1000/60 líneas p95<20ms. Para staging fijar presupuesto después de una línea base real de CPU, memoria, latencia, consultas y suscripciones. No se midió Realtime/CPU frontend producción; suscripciones/timers de app.js conservados, sin claim de mejora global.

Capturas revisadas: docs/screenshots/centre-pl-mobile.png y centre-en-desktop.png. Centro responsive y traducido, botones sensibles siguen bloqueados. No es una certificación completa WCAG ni regresión visual de todas las pantallas. Algunos glifos emoji dependen de fuentes del sistema.

Integridad y repetición desde ZIP limpio: PACKAGE-VERIFICATION.json. No contar las mismas339 pruebas repetidas como nuevas pruebas únicas.

## Segunda revisión

7 nuevos casos locales prueban límites finitos de cola, URL staging canónica, token validado por auth server, representación/timeout, fixture inexistente, denegación y restauración de mutación, y prohibición de mutar producción/entorno desconocido. Los9 casos remotos permanecen SKIP, no pass. Un401 autenticado y un fixture vacío ya no son evidencia de aislamiento. Sin cambios RLS para aprobar tests.

Chromium temporal estaba truncado tras restauración del entorno y fallaba SIGSEGV antes de aserciones; se restauró del tooling y se repitieron51 ejecuciones, todas verdes. Frontend intacto en este bloque. Microbenchmarks publicados corresponden al bloque anterior; no se atribuye una mejora adicional de CPU a esta revisión.
