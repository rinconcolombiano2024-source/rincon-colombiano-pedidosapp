# RC ORDERA V6 — instalación, staging y recuperación

Esta entrega consolida dos fuentes; no autoriza producción, cobros, reembolsos ni impresión física. Las rutas legacy y los motores de pedidos/pagos/cierres de GitHub se conservan. `accounting/` calcula auditorías offline sobre exportaciones, sin escribir en Supabase ni crear un segundo cierre operativo.

## 1. Instalar y verificar el paquete

1. Descomprimir en un directorio nuevo. Node >=22; se verificó con Node24.19.0.
2. Ejecutar `sha256sum -c MANIFEST-SHA256.txt` desde la raíz.
3. `npm ci --ignore-scripts --no-audit --no-fund`.
4. `npm run qa`, `npm run qa:fiscal`, `npm run qa:delivery`, `npm run qa:readiness`, `npm run qa:fiscal-agent`, `npm run qa:accounting`, `npm run qa:v5`.
5. `npm run android:prepare-web` conserva las fuentes y genera www; incluido el centro de integraciones. No añadir manualmente cambios divergentes en www.
6. `npx playwright install --with-deps chromium` y `npm run qa:e2e`. El Python smoke adicional requiere `python3 -m pip install playwright` y `python3 -m playwright install chromium`; luego `npm run qa:browser`.

## 2. Configurar sin exponer secretos

Conservar `supabase-config.js` público para URL y anon key; nunca introducir service_role, Stripe secret o credenciales del agente en la raíz pública o www. El escáner advierte claves públicas Google: revisar restricciones de dominio/API en su consola. No se cambiaron secretos existentes.

Variables del backend existentes, según la función desplegada:

|Ámbito|Variables|
|---|---|
|Supabase|SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY|
|Pagos|STRIPE_SECRET_KEY (solo test durante QA), PAYMENT_SETTLEMENT_SECRET, APP_BASE_URL|
|Mapas/traducción|GOOGLE_ROUTES_API_KEY, GOOGLE_TRANSLATE_API_KEY|
|Repartidores/push|DELIVERY_DISPATCH_SECRET, COURIER_PUSH_WEBHOOK_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT|
|CORS|RC_ALLOWED_ORIGINS: dominios staging y autorizados; RC_ALLOW_LOCALHOST_DEV=1 solo desarrollo. Defaults incluyen dominio público actual y orígenes Capacitor.|
|Inbox de pruebas legacy|RC_EXTERNAL_ALLOWED_ORIGINS, RC_EXTERNAL_TEST_ENABLED, RC_EXTERNAL_TEST_RESTAURANT_ID, RC_EXTERNAL_TEST_SECRET; mantener desactivado en producción.|
|Gateway fiscal|RC_FISCAL_AGENT_ENABLED: ausente = deshabilitado; test = únicamente mock test.|

Las variables no necesarias para un módulo no deben configurarse con valores ficticios. Conservar además las configuraciones específicas indicadas por las guías de pagos existentes. Las firmas Stripe, idempotencia y permisos anteriores se mantienen.

## 3. Preparar Supabase sin sobrescribir historial

1. Crear/clonar un proyecto separado de staging. Hacer backup de esquema, datos y definiciones RPC; exportar el inventario de migraciones realmente aplicadas.
2. No ejecutar todos los .sql por orden alfabético o numérico: hay ramas históricas con números repetidos (04/27 y otros). Esos archivos históricos NO se renumeraron ni cambiaron. Las dos adiciones V4 nunca aplicadas en esta sesión se asignaron a identificadores V5 únicos.
3. Revisar `V5-MIGRATIONS.json`. Mantener los review gates GitHub V91-69 y V91-70. Verificar que staging contiene las dependencias V91-34/35, V91-29A y los helpers/columnas de pedidos requeridos.
4. Aplicar cada migración V5 no aplicada una sola vez, en este orden: `MIGRACION-V5-20261010-01-FISCAL-AGENT-RESULT.sql`, `...02-ORDEN-IDEMPOTENTE-IVA.sql`, `...03-DELIVERY-OUTBOX.sql`, después `...04-VAT-CATEGORIES.sql`, `...05-ORDER-MENU-INTEGRITY.sql`, `...06-OUTBOX-BOUNDS.sql` y `...07-DISPATCH-COLUMN-ALIAS.sql`. Si01–03 ya están aplicadas, no reejecutarlas: comprobar ledger y empezar en04.
5. Cada archivo usa transacción, precondiciones y comprobaciones de permisos. La migración02 rechaza un cuerpo RPC distinto al baseline revisado mediante MD5 de prosrc normalizado; no editar el hash para forzarla. Comparar y reauditar primero la variante desplegada.
6. Revisar postcondiciones y probar fixtures. No marcar la migración aplicada si hubo rollback. No borrar pedidos ni tokens de acceso para corregir fallos.
7. Desplegar Edge Functions únicamente en staging después del SQL; el gateway mantiene `verify_jwt=false` porque valida token propio por dispositivo, hash y pertenencia de restaurante. Ningún PC recibe service_role.
8. Asignar `vatRate` por producto y, si procede, `defaultVatRate` mediante configuración revisada por el contador. Las tasas desconocidas permanecen NULL en snapshots y el auditor informa incidencia. La interfaz del menú para editar IVA aún requiere trabajo; no afirmar IVA completo para datos sin tasa.

## 4. Probar aislamiento y concurrencia reales

Configurar fixtures desechables según `tests/integration/support/supabase-rest.cjs`, con RC_TEST_SUPABASE_URL, RC_TEST_SUPABASE_ANON_KEY, RC_TEST_CONFIRM_TEST_PROJECT=YES, actores A/B y RC_TEST_CONCURRENCY_PLAN. Ejecutar `npm run qa:integration` y exigir cero skips/TODO en los escenarios que se pretenden certificar. Los dos escenarios de mutación están implementados y deben ejecutarse en staging; no están certificados por tener tests locales.

`RC_TEST_ENVIRONMENT=staging FUNCTIONS_URL=... ANON_KEY=... RESTAURANT_USER_ID=... PRODUCT_ID=... npm run verify:concurrency` crea pedidos de prueba; usar exclusivamente staging. La autoprueba no prueba Supabase ni concurrencia entre conexiones PostgreSQL reales: las pruebas PGlite ejecutan SQL real con workers lógicos en un motor local que serializa las consultas.

## 5. Puente fiscal: primero POSNET, sin emisión ficticia

1. RC ORDERA es POS: la impresora autorizada emite el documento fiscal. Confirmar modelo POSNET, firmware, puerto y protocolo oficial. El driver POSNET pendiente falla cerrado.
2. El CLI V5 solo admite mock. NoviAPI se conserva únicamente para simulación con fetch inyectado; no es un protocolo validado ni se habilita con credenciales físicas.
3. En staging, registrar dispositivo enabled=true, environment=test, driver_id=mock; generar token aleatorio de al menos32 bytes y guardar su SHA256 en agent_token_hash. Configurar el gateway en modo test.
4. En PC de pruebas: RC_GATEWAY_URL (HTTPS), RC_DEVICE_ID, RC_DEVICE_TOKEN, RC_FISCAL_DRIVER=mock, RC_JOURNAL (ruta privada persistente). Ejecutar `node fiscal-agent/bin/rc-fiscal-agent.mjs`.
5. El journal escribe y sincroniza a disco antes del envío. Un lock excluye procesos locales duplicados. Si el proceso cae, inspeccionar journal y servidor; eliminar el directorio .lock SOLO después de comprobar que no hay otro proceso activo y reconciliar. Nunca borrar el journal.
6. PENDING corresponde a pending; PROCESSING a claimed/sending. UNKNOWN bloquea el dispositivo y nunca vuelve automáticamente a pending. Un ACK perdido de mark_sending conserva incertidumbre aunque no se haya enviado al dispositivo. Si la operación quedó claimed, reconciliar administrativamente con evidencia de no envío; no resetear a ciegas.
7. Probar respuesta perdida, caída del agente, resultado repetido, claim exclusivo y reinicio. Las confirmaciones mock se marcan simulated=true/fiscal=false y no constituyen recibos legales.
8. No habilitar dispositivos production en esta versión. Requiere adapter oficial, tipos de pago/PTU revisados, reconciliación física y autorización explícita.

## 6. Reparto y pagos

- Default delivery registry sigue sin proveedores habilitados. Prepared registry conserva plantillas V4 y alias normalizados. Los ejemplos heredados NO son contratos oficiales.
- Para producción, registrar adaptador revisado con credenciales scoped al restaurante y pruebas oficiales por proveedor. No declarar safeRetries hasta validar idempotencia real; una cabecera inventada no la garantiza.
- Inyectar PostgresOutboxStore con query parametrizado de backend confiable y restaurantId; no conectar el store a navegador/anon. La tabla y journal son privados; no hay worker/cron automático activado. No exponer tokens en eventos ni payloads.
- Workers expirados -> UNKNOWN; se conserva la operación. Reconciliar con evidencia del proveedor a sent o dead. La API de recuperación no reencola una operación incierta.
- Conservar Stripe existente; probar checkout, webhook firmado, duplicados, cancelación, reembolso, reversal y settlement en Stripe test. No crear otra engine. BLIK depende del checkout configurado y elegibilidad de la cuenta; queda pendiente verificación de sandbox.
- La conversión de eventos oficiales a inbox GitHub/pedido interno y callbacks de cocina necesita staging y payloads oficiales; no se activó una importación real.

## 7. Auditoría contable compatible

Exportar un solo restaurante y moneda; adaptar filas con accounting/src/adapters.mjs. Ejecutar CLI sobre copias de prueba. No programar/publicar cierres contables automáticamente.

El auditor detecta referencias, IDs y allocations duplicados; excluye registros ambiguos e invalida el informe. Gross/net/VAT usan minor units y redondeo por documento. `vat` mantiene ventas brutas, `refundVat` separa correcciones y `vatAfterRefunds` resta ambas. Reembolsos requieren vatLines verificadas; sin ellas el cierre se marca inválido. Las cantidades de producto usan snapshots. La fecha de venta sigue created_at del contrato V4; revisar con contador si necesita fecha contable distinta. DefaultVatRate configura una suposición y se etiqueta; no determina por sí solo la tasa fiscal del plato o servicio.

## 8. Vercel y Android

Preparar preview de esta rama, sin actualizar alias de producción. Mantener vercel.json y .vercelignore. Verificar404 de SQL, documentación, bridges, accounting, package.json, MERGE-MATRIX.json, V5-MIGRATIONS.json y archivos .env. `SITE_URL=... FUNCTIONS_URL=... npm run verify:deploy` es una verificación postdeploy; no fue ejecutada contra producción.

Probar ES/PL/EN, pedidos/cocina/meseros/históricos/cierres, cambio de sesión y conexión móvil. Verificar CORS del dominio nuevo. Mantener CSP activa hasta que las pruebas reales permitan endurecerla; Report-Only no es bloqueo. Capacitor se actualizó a8.5.3 y requiere reconstruir/reinstalar la app Android para aplicar el parche; no se compiló APK en este entorno.

## 9. Recuperación

Antes de habilitar: anotar commit/deployment anterior, backup de funciones SQL y Edge Functions y estado de colas. Si falla: deshabilitar gateway/worker/conector; restaurar frontend/Edge Functions al commit anterior. Los cambios SQL son aditivos salvo nuevas definiciones RPC: restaurar sus definiciones exactas del dump previo bajo transacción y validación, sin revertir datos confirmados. Conservar tablas, snapshots y journal. No borrar ni reimprimir UNKNOWN. El rollback de la nueva outbox consiste en parar workers y dejar evidencia, no borrar operaciones. Revisar diferencias de estados antes de reabrir.

La autorización para merge, despliegue, cobros/reembolsos y hardware real es un paso posterior.

## 10. Gate adicional production-hardening

- Leer HARDENING-REPORT/QA-REPORT y ejecutar qa:hardening, qa:policy y la matriz RC_E2E_FULL_MATRIX=1 qa:e2e. CI no puede convertir skips/TODO staging en aprobación. Validar0 fallos,0 saltos en los escenarios externos a certificar.
-04 no cambia ventas anteriores: conservar NP/NP I/NP II/ZW/0 como categorías separadas. Mapping A/B/C/D/E requiere PTU oficial del dispositivo y revisión contable; valores desconocidos no se adivinan. Revisar snapshots históricos incorrectos con contador, no UPDATE masivo.
-05/07 comparan hash RPC anterior. Guardar pg_get_functiondef/prosrc y grants en backup; si no coincide, detener y comparar implementación desplegada. No editar guards para forzar aplicación.
-06 agrega CHECK/índices; timeout protege un despliegue que no consigue locks. Prevalidar filas antiguas, medir índices/EXPLAIN en staging y programar ventana controlada. No borrar outbox inválida ni eventos para aprobar constraint.
-Workers: batchSize<=500 (default100), maxTickMs por defecto15s, consulta paginada, timestamps de lease por comando; contrato due obligatorio. UNKNOWN requiere evidencia y nunca reencolado automático. Vigilar profundidad pending, edad oldest, unknown, latencia por proveedor y lease expiradas.
-Stripe: solo claves test en staging. Verificar replay/webhook duplicado, pago tardío, refunds parciales/completos, Connect fee/transfer/reversal y moneda antes de habilitar cobros. Ningún resultado mock valida BLIK.
-CSP activa ya no permite unsafe-eval. Probar rutas existentes, Maps y Capacitor en preview. unsafe-inline continúa: migración nonce/hash requiere inventario de scripts y prueba completa antes de eliminarlo.
-Probar cache SW antigua→nueva, offline/reconexión, cambios de sesión y menú modificado. Con almacenamiento bloqueado, memoria de ID/token no sobrevive recarga; detener emisión ambigua y reconciliar, no prometer reintento cross-session seguro.
-Preparar dashboards/alertas sin instalar secretos en el paquete: errores Edge,429, tiempo RPC, duplicados, incertidumbre fiscal/pagos, WebSocket/dispositivos y budget CPU/memoria. No se configuró monitoreo externo en esta sesión.
-Rollback: parar ingreso/conectores primero; restaurar frontend/Edge y definiciones RPC exactas desde backup con grants preservados. Mantener datos, tokens, eventos, nuevas columnas y categorías fiscales correctas; no volver a un normalizador NP→ZW. Comprobar recibos/pagos antes de reabrir. Un rollback de código no revierte operaciones físicas ni pagos.

## 11. Gate de autenticación y mutación revisado

-URL del test HTTPS (HTTP solo localhost), sin credenciales/path/query/hash, distinta de producción tras normalizar host/puerto. No usar alias del proyecto activo.
-Tokens se verifican por /auth/v1/user y deben corresponder a usuario authenticated, nunca service_role. Timeout15s; auth fallida no prueba aislamiento.
-Crear fixtures desechables legibles por propietario: pedidos/configuración/membresías, perfil/pedido cliente y perfil repartidor. Una tabla vacía no certifica aislamiento.
-Mutación: RC_TEST_CONFIRM_MUTATION_FIXTURES=YES y RC_TEST_RESTAURANT_B_MEMBERSHIP_ID de una membresía activa desechable; actores A/B y RC_TEST_CONFIRM_TEST_PROJECT=YES. No personas/datos reales. Solo intenta updated_at de configuración y active de esa membresía exacta; verifica integridad y restaura por propietario si un defecto permitiera escritura. Restauración fallida requiere detener y reconciliar el fixture. No se cambian pagos ni importes.
-Exigir9 escenarios remotos ejecutados,0 skips/0 TODO/0 fallos antes de afirmar certificación. Sin acceso, producción sigue bloqueada.

Antes de conectar un repositorio nuevo o una preview a Vercel, configurar supabase-config.js con URL/anon key del proyecto staging separado. El paquete conserva la configuración pública original; una copia de frontend no crea una base aislada automáticamente. No iniciar sesión ni probar ventas contra producción desde la copia.

## Cambios específicos de la consolidación V6

1. Revisar MERGE-REPORT.md, QA-REPORT.md y matriz V6. Mantener repositorio GitHub principal; trabajar solo en rama. No sustituir main con un ZIP.
2. En staging, comprobar las dependencias del plan. Conservar01..07 ya aplicadas; aplicar08 original una sola vez y después09 (budget fence) y10 (null IVA explícito).09 exige cuerpo RPC esperado y buckets horarios UTC;10 exige cuerpo V5-05 esperado. Si hay drift, detener y reconciliar: no retirar las guardas. Ambas verifican permisos posteriores. Aplicar08 y09 en la misma ventana de mantenimiento antes de habilitar la Edge nueva.
3. Variables adicionales, solo backend: RC_TRANSLATE_GLOBAL_HOURLY (por defecto2000, rango100..50000) y RC_TRANSLATE_GLOBAL_DAILY (por defecto10000, rango100..500000). Ajustar según presupuesto económico. La ventana diaria incluye conservadoramente toda la hora parcial más antigua. Falta v2=>503; nunca configurar fallback pagado a v1. Verificar Google Translate en proyecto test con coste controlado.
4. Desplegar translate-public-content solamente después de09. Verificar cached200, quota429, missing migration503, body413 y provider502 sin reintentos automáticos. Para rollback de esta función, deshabilitar proveedor pagado, conservar caché/counters; no volver automáticamente a v1/08.
5. Antes de habilitar pedidos con el editor IVA, verificar10. Inventariar categorías por producto con contable; NP/NP I/NP II/ZW/0 son distintas. Las letras PTU de impresora no son tasas universales. Ausencia vatRate hereda default configurado; null explícito permanece desconocido. El auditor conserva la presencia del snapshot y señala VAT_SNAPSHOT_UNKNOWN; no aplicar un default contable a ese caso. Solo entradas legacy sin snapshot admiten un default explícito marcado como asumido. No reescribir recibos previos: investigar snapshots sospechosos con procedimiento contable.
6. Agregación contable opt-in: exportaciones deben proporcionar event_id único del movimiento y currency/amount exactos con signo. provider reference conserva la identidad de venta; no sirve como ID de cada cargo/reembolso. Sin identidad verificable, conservar modo conservador. El auditor no escribe liquidaciones ni produce un segundo cierre operativo.
7. QR local: archivos vendor/qrcode-generator-2.0.4.js, su licencia y local-qr.js se distribuyen desde el mismo origen y www. No necesita claves ni API externa. Verificar escaneo real con móvil, enlace/mesa y persistencia después de publicar; no eliminar la biblioteca o su licencia para reducir tamaño.
8. Ejecutar npm ci, npm run qa, npm audit, matriz E2E y nueve pruebas live con fixtures desechables. Preparar www y exigir git diff --exit-code -- www/. Python smoke opcional requiere playwright; CHROME_PATH permite Chromium instalado. No activar transacciones comerciales ni fiscalización para probar UI.
9. Conexiones nativas PostgreSQL: probar requests simultáneas en transacciones independientes, saturación de cuota, límites de locks/timeouts, reclamación de reparto y reinicio. PGlite local no sustituye estas verificaciones.
10. Recovery de pedidos: pausar entrada si hay incompatibilidad; conservar ventas, pagos, tokens, colas y snapshots; restaurar frontend compatible y avanzar con corrección SQL. Nunca aplicar down-migration destructiva ni NP=>ZW. UNKNOWN fiscal/reparto requiere evidencia de conciliación, no reimpresión/envío automático. Archivo docs anterior es histórico, no certificación del entorno.

No se generó APK ni se desplegó Vercel/Supabase. El workflow existente ya ejecuta QA, audit, sincronía www y matriz E2E, y recoge automáticamente las pruebas nuevas. Mantener revisión antes de producción y validar CI remoto cuando existan permisos.
