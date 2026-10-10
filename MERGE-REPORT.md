# RC ORDERA V6 — consolidación verificada

GitHub main sigue siendo la fuente integrada de referencia: `2730150506122ae59ba142ca1ba84ec820acb301`, comprobado nuevamente por fetch. Base de trabajo: última V5 `fae1e3cc62eb792eb2ef67ea4de44ecf38d9f35f`. ZIP recibido: `RC-ORDERA-V6-ROBUSTA.zip`, SHA-256 `41f6557de3371bd040fab87b38c99e41cfeeb8c53a6b9b6363280b97f95c3c34`. CRC correcto y extracción validada contra rutas inseguras y enlaces simbólicos. No se modificó main ni se ejecutaron operaciones de producción.

## Comparación y decisiones

498 rutas en la unión de GitHub/V5/V6; GitHub398 archivos, V5484, V6489. Entre V5/V6:482 compartidos,453 idénticos por bytes,29 diferentes,7 nuevos de V6 y2 pruebas/ayudantes de V5 ausentes en V6. Se registró la matriz antes de editar componentes críticos. `V6-COMPARISON-MATRIX.json` contiene cada hash original y decisión A/B/C/D/E. La comparación completa de bytes no equivale a revisión manual exhaustiva de toda combinación funcional: la revisión de lógica se concentró en diferencias y rutas críticas, con regresión automatizada del resto.

|Decisión|Archivos y resultado|
|---|---|
|A conservar GitHub/última V5|Cliente, mesero, colaborador, admin, centro de integraciones, permisos, Realtime, cierre operativo y motor de pagos existentes. Se restauran respecto al ZIP los controles de tests/integration, release-gates y mutation-probe.|
|B incorporar V6|CSP sin unsafe-inline/eval en scripts, prueba CSP, prueba CLAIM_LOST, navegador Python y SQL08 original.|
|C fusionar|Editor de IVA app/restaurante, ES/PL/EN, configuración, outbox con CLAIM_LOST y límites originales de V5, www y plan incremental.|
|D corregir antes de integrar|Conciliación agregada, normalización fiscal, cuota pagada y casos de prueba que presuponían las conversiones o degradaciones inseguras.|
|E excluir|Cero eliminaciones nuevas. Siete archivos download residuales ya excluidos en V5 se mantienen fuera; evidencia histórica en docs/MERGE-V5-HISTORICAL.md.|

## Defectos corregidos y evidencia

1. P0: V6 convertía NP en ZW y suponía A/B/C/D/E como tasas universales. Ahora NP, NP I, NP II, ZW y0 permanecen distintos. Las letras requieren configuración PTU verificada del dispositivo; una categoría explícita desconocida conserva su valor y exige revisión antes de editar. Un null explícito no hereda23 del restaurante: migración10 y SQL ejecutado. El adaptador contable conserva la presencia del snapshot; un snapshot explícito desconocido invalida el cierre, incluso ante default23, conservando el importe. Los pedidos legacy sin snapshot pueden seguir usando un default explícito marcado como asumido. Solo la ausencia deliberada de vatRate hereda. Un ajuste remoto null limpia el valor local anterior. Las categorías del menú deben verificarse por un profesional contable; el programa no determina por sí solo el tratamiento de cada producto.
2. P0: agregar referencias sin identidad del movimiento podía ocultar duplicados. La opción aggregateProviderRows exige event_id oficial único, incluso entre referencias distintas, y documenta movimientos agregados. Sumas enteras verificadas, overflow explícito y estados/importes de reembolso consistentes. El modo por defecto sigue bloqueando referencias repetidas. Es un auditor de exportaciones; no sustituye el motor operativo de pagos/cierres.
3. P1: V6 eliminaba validación de presupuestos de cola y pruebas de aislamiento. Se conserva última V5, con backend getUser, proyecto de pruebas distinto de producción y mutation-probe recuperable. CLAIM_LOST ya no aborta todo el lote; cuenta lost sin declarar sent y conserva recuperación UNKNOWN. Otros errores del almacén se propagan.
4. P1: SQL08 consultaba cuota diaria antes de una exclusión transaccional, omitía la hora parcial más antigua, creaba identidades después del límite global e incrementaba contadores agotados. SQL09 conserva08 intacta y serializa comprobación/incremento mediante advisory transaction lock; incluye conservadoramente toda la hora parcial, evita nuevos clientes tras denegación y limita limpieza a200 identidades/72 buckets con CTE materializada. Requiere verificar conexiones PostgreSQL independientes en staging: PGlite serializa llamadas.
5. P1: la Edge Function degradaba silenciosamente a cuota v1 sin límite global. Ahora exige v2 y devuelve503 si falta la migración; la caché sigue disponible. Cabeceras IP se consideran no verificadas. Cuerpos reales de solicitud limitados a8192 bytes/5s, proveedor con timeout10s y ningún reintento pagado automático. JSON null/escalar/lista inválido no produce excepciones sin controlar.
6. P2/privacidad: el QR del restaurante enviaba el enlace a api.qrserver.com. Ahora se genera localmente, con biblioteca MIT fijada y sin modificaciones; caché acotada al último enlace y generación UTF-8. Navegador decodifica el GIF al URL exacto. Solo se añadieron dos dependencias justificadas: generador QR y jsqr como decodificador de prueba.
7. Seguridad/distribución: CSP aplica hash del script inline autorizado, bloquea inline no autorizado y new Function; fuentes y45 activos www coinciden. Caché PWA recibe identidad nueva. Se mantienen host allowances existentes; default-src/connect-src completos siguen Report-Only hasta validar Maps y Stripe reales.

## Migraciones y contratos

No se renumeraron ni sobrescribieron migraciones históricas. V5-01..07 permanecen idénticas a la última V5;08 idéntica al ZIP recibido.09 y10 son incrementales con precondiciones, hashes del cuerpo existente, privilegios y verificaciones posteriores. V5-MIGRATIONS.json registra diez identificadores inequívocos y dependencias. No hay cambio masivo de datos ni recibos históricos. Recovery: desactivar endpoint pagado o pausar entrada de pedidos si corresponde; conservar datos, revisar y avanzar con corrección. No volver automáticamente a NP=>ZW ni a cuota v1.

Referencia oficial revisada: Ministerio de Finanzas polaco, información FA(3) (np I/np II y zw): https://ksef.podatki.gov.pl/media/4u1bmhx4/information-sheet-on-the-fa-3-logical-structure.pdf ; JPK_FA para np: https://www.podatki.gov.pl/podatki-firmowe/jednolity-plik-kontrolny/jpk_vat/pytania-i-odpowiedzi-jpk_vat ; exención zw: https://www.podatki.gov.pl/poradniki-i-informatory/rozpoczecie-dzialalnosci-gospodarczej . Consultadas2026-10-10. Esto fundamenta preservar categorías distintas, no autoriza automáticamente una tasa de producto ni un protocolo fiscal.

## Estado por módulo y bloqueos externos

|Módulo|Estado verificado y límites|
|---|---|
|Pedidos/POS/cocina/meseros|Motor existente conservado, idempotencia, snapshots, precio/cierre, UI y recuperación probados localmente. Faltan fixtures Supabase y dispositivos reales.|
|Fiscal|Persistencia, exclusión y UNKNOWN sin reimpresión automática probados en simulación. POSNET/Elzab permanecen bloqueados sin protocolo/modelo verificado; NoviAPI provisional no transmite a hardware. RC ORDERA continúa siendo POS.|
|Reparto|Cola persistente, reclamación SQL, tenant, UNKNOWN, recuperación y CLAIM_LOST probados. Adaptadores provisionales no se presentan conectados; falta autorización oficial de cada plataforma.|
|Pagos|Motor Stripe/Connect existente y rechazo de webhooks inválidos preservados. No se certifican cobros, BLIK ni reembolsos reales/sandbox oficial.|
|Contabilidad|Importes, IVA separado, cantidades, duplicados, reembolsos y auditoría agregada probados. Contable debe validar categorías y exportaciones comerciales.|
|Administración/idiomas|Centro ES/PL/EN y editor IVA probados en móvil/tableta/escritorio; sin acciones externas habilitadas ficticiamente. No certifica WCAG completa.|
|Producción|Candidata a staging. RLS Supabase live, PostgreSQL independiente, contratos comerciales, hardware, APK/GPS/Deno y observabilidad siguen pendientes.|

Rama local `codex/rc-ordera-v6-consolidada-verificada`, commits organizados. GitHub create_branch devuelve403 Resource not accessible by integration. No hay rama remota ni PR creado; el texto PULL-REQUEST.md y GITHUB-BRANCH.patch permiten transferencia revisable. No afirmar publicación inexistente. QA y verificación del ZIP: QA-REPORT.md y PACKAGE-VERIFICATION.json.

## Cifras de entrega

Conteos basados en rutas y bytes; inventario verificable en AUDIT-INVENTORY.json. Las categorías de fusión/corrección pueden solaparse; no sumar como archivos únicos.

|Concepto|Resultado|
|---|---|
|Archivos analizados de las fuentes|498 rutas de unión|
|Archivos finales|510|
|GitHub conservados idénticos|356;35 adicionales conservados con modificaciones revisadas|
|Archivos exclusivos V6 incorporados|7, corregidos cuando correspondía|
|Archivos fusionados categoría C|9|
|Archivos de implementación corregidos|9, incluyendo2 migraciones correctivas; lista explícita en inventario|
|Archivos eliminados en esta revisión|0;7 descargas residuales excluidas previamente en V5|
|Pruebas Node/E2E aprobadas|433 ejecuciones (370+63), sin contar repeticiones del ZIP|
|Pruebas finales fallidas|0|
|Pruebas live bloqueadas|9|
|Problemas críticos pendientes|Validación independiente PostgreSQL/Supabase, pagos sandbox, hardware fiscal y contratos oficiales; no hay certificación de producción|
|Integraciones funcionales|Simulación y guardas locales verificadas; ninguna conexión comercial/física nueva declarada|
|Estado V6|Candidata a staging; permisos GitHub403 bloquean publicación remota|
