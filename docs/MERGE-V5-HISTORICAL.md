> Informe de consolidación V5 anterior. Estado actual y correcciones: HARDENING-REPORT.md y QA-REPORT.md. La matriz E2E actual pasa51 ejecuciones; conexiones externas siguen pendientes.

# RC ORDERA V5 — fusión implementada

Fuentes verificadas: main de GitHub, commit2730150506122ae59ba142ca1ba84ec820acb301; `rincon-colombiano-pedidosapp-v4.zip` adjunto (SHA256 02218aedf98b26856263817bde07856ca9b53fe7982a495d58840e203d851bcd).

## Comparación de contenido

441 rutas de archivos distintas:346 idénticas,25 diferentes,27 exclusivas GitHub,43 exclusivas V4. GitHub contiene398 archivos; V4 contiene414. Se compararon bytes y diferencias de líneas; `MERGE-DIFF.patch` conserva diferencias de las fuentes, `MERGE-MATRIX.json` clasifica cada ruta y registra destino/hash final. La revisión funcional se concentró en cambios, contratos críticos y pruebas; no equivale a certificar toda combinación de UI o el sistema desplegado.

|Concepto|Cantidad y definición|
|---|---|
|GitHub conservados sin cambio de bytes|373|
|GitHub modificados|18|
|V4 exclusivos incorporados|42 (incluye2 SQL con destino V5)|
|Archivos fusionados|16 rutas categoría C; incluye configuración y workflows|
|Archivos corregidos|37 con contenido final distinto del baseline integrado; se superpone con fusionados|
|Archivos GitHub eliminados|7 snippets download sin referencias runtime|

Listas exactas: `MERGE-COUNTS.json`. Los contadores no se suman: correcciones/fusiones pueden corresponder a una misma ruta. Los archivos de pruebas/reportes y store PostgreSQL nuevos fuera de ambas fuentes figuran en el manifiesto, no se atribuyen falsamente a V4.

## Conservar GitHub

Se conservaron sin recortar app.js, cliente.js, mesero.js, colaborador.js, admin.js, idiomas, service-worker, panel externo reciente, centro de integraciones, integration-guards/readiness/status y controles del servicio/registro fiscal. V4 borraba el panel reciente y debilitaba validaciones de drivers, identidad y concurrencia; esas versiones no se usaron. No se reemplazó el motor de pagos/pedidos/cierres ni se alteraron migraciones históricas.

## Incorporar y consolidar V4

Se incorporaron agente/gateway fiscal de pruebas, templates de cinco proveedores, utilidades canónicas y cola saliente, auditor contable offline, validaciones CORS/secretos, scripts y pruebas. El registro por defecto de reparto permanece cerrado: las plantillas se ofrecen separadamente para simulación y revisión. Identificadores convergen a uber_eats/bolt_food sin romper los registros de readiness de GitHub. Los módulos de contabilidad no escriben un cierre POS paralelo: auditan exportaciones del motor existente.

## Defectos corregidos

1. Fiscal: ACK perdido o respuesta inválida tras POST/confirmación permanece UNKNOWN; NoviAPI queda simulation-only, CLI mock-only y gateway OFF por defecto. Journal fsync y lock local; resultados del servidor reintentables con token/evidencia idéntica; identidad de operación obligatoria. Se conserva bloqueo exclusivo de V91-35.
2. Reparto: get/put en memoria permitía2 envíos. Insert/claim/finish atómicos con fencing, store PostgreSQL por tenant, estados processing/unknown, journal, expiración conservadora y reconciliación explícita. Memory store solo pruebas. No hay reintento automático de respuesta incierta ni interpretación genérica de409 como éxito.
3. Contabilidad: grupos duplicados no se sobrescriben. Dinero con enteros y guardas de precisión; IVA se agrupa por documento, no por todas las ventas del día. Referencias/IDs/allocations ambiguos invalidan el auditor; cantidades por snapshots; correcciones IVA de refund separadas y explícitas.
4. Integridad/seguridad: CORS rechaza origen no permitido antes del handler, comparación de secretos sin igualdad ingenua, IDs canónicos ausentes rechazados, firmas HMAC malformadas y minor units fuera del rango seguro rechazados. Aislamiento RLS anterior preservado.
5. Distribución: prepare-capacitor añade portal/centro/status/licencia vendor y comprueba bytes. No se elimina ningún archivo legítimo de compilación/distribución.
6. Dependencias: Capacitor Android/core/CLI8.5.0→8.5.3 y lockfile exacto. Advisory GHSA-rvm3-566m-v7fv confirmado con fuente oficial; npm audit productivo pasó de1 crítica a0. APK requiere rebuild posterior.

## Migraciones

Las adiciones V4 V91-69-FISCAL-AGENT-RESULT y V91-70-ORDEN-IDEMPOTENTE-IVA no fueron aplicadas en esta sesión y se incorporan con IDs V5-20261010-01/02. NO sustituyen V91-69-EXTERNAL-REVIEW-GATE ni V91-70-EXTERNAL-BATCH-REVIEW-COMPAT. V5-20261010-03 añade outbox privada. Todas se probaron en fixtures PostgreSQL locales; staging real y ledger desplegado siguen pendientes. Hay numeraciones repetidas históricas de GitHub: se conservan y se prohíbe aplicar por simple orden de nombre. Ver V5-MIGRATIONS.json y checklist.

## Limpieza demostrada

Se eliminaron7 archivos extensionless download*, cada uno snippet redundante de ignore/attributes y sin referencia desde runtime/build. Las configuraciones necesarias quedan en .gitignore y .vercelignore. Se descartó .gitattributes V4 para evitar normalizar y reescribir todo el código conservado. No se quitaron tests, módulos runtime, históricos SQL ni capacidades.

## Estado

Consolidación implementada y lista para revisión. No certificada para producción: faltan E2E con navegador, staging multitenant completo, conexiones/credenciales comerciales, pruebas Stripe/BLIK, POSNET físico/protocolo e interfaz IVA de menú. Los resultados y bloqueos constan en QA-REPORT.md. No hay promesa99.9% ni mejora CPU sin medición.

Rama local: codex/rc-ordera-v5-consolidada. Publicación remota y PR bloqueados por HTTP403 de la conexión GitHub; Git local tampoco tiene credenciales de push. GITHUB-BRANCH.patch conserva los commits preparados y PULL-REQUEST.md contiene el texto. No se creó PR remoto ni se desplegó. ZIP y rama usan el mismo árbol de código; el manifiesto de entrega no se autohashea.
