> Informe histórico de endurecimiento V5. Estado actual V6: MERGE-REPORT.md y QA-REPORT.md. No usar las cifras históricas como certificación de esta entrega.

# RC ORDERA — hardening verificable sobre V5

Trabajo en `codex/rc-ordera-production-hardening`, sin modificar main ni producción. Base V5: `b90112556aba4ea08799499b46f083e677b4f659`; main consultado: `2730150506122ae59ba142ca1ba84ec820acb301`. Se reutilizó la consolidación real GitHub/V4; no se copió otra aplicación. Los informes MERGE históricos describen esa fase; este informe y QA-REPORT describen la entrega actual.

## Correcciones y evidencia

|Prioridad|Defecto comprobado|Corrección mínima y prueba|
|---|---|---|
|P0|NP era normalizado como ZW; categorías y letras fiscales podían confundirse.|Migración incremental04 conserva NP, NP I, NP II, ZW y 0 distintos. No reescribe snapshots históricos. Letras de dispositivo solo mediante mapping explícito revisado. Pruebas financieras y RPC.|
|P0|Pedidos aceptaban cantidades no enteras o precios de catálogo ausentes/negativos; productos duplicados podían seleccionar una entrada arbitraria.|Migración05 valida identidad, cantidades y precio autoritativo; rechaza un precio mostrado que cambió. Reintento de venta pagada conserva sus snapshots. Conserva RPC, token, locks, cuota y permisos.|
|P0|ACK tardío podía confirmar otra sesión; envíos paralelos con almacenamiento bloqueado podían duplicar ventas.|Single-flight de cliente, memoria de ID/token para respuesta perdida y comprobación de identidad de respuesta/sesión. 100 solicitudes simultáneas y recuperación probadas en VM y Chromium. Memoria no sobrevive recarga si almacenamiento está bloqueado: no se certifica recuperación entre sesiones en ese caso.|
|P0|Un recibo mock CONFIRMED podía satisfacer un cierre que exigía fiscalización real.|Cierre exige fiscal=true y simulated!=true. UNKNOWN no se reimprime. POSNET permanece bloqueado, sin inventar protocolo.|
|P1|Dos runOnce/recover concurrentes del agente podían competir; un journal cerrado podía retirar el lock de un propietario posterior.|Single-flight y recuperación serializada; journal cerrado no escribe y close es idempotente. Pruebas de 100 llamadas y propietario nuevo. Locks durables/claim SQL anteriores conservados.|
|P1|Dispatch fallaba con PostgreSQL variable_conflict=error: columna station_status ambigua (42702).|Migración07 califica únicamente los dos UPDATE de dispatch. Prueba del RPC real y permisos, entregas presencial/recogida y bloqueo financiero de domicilio.|
|P1|CHECK de outbox podía aceptar JSON incompleto por semántica NULL; lectura de todo el historial crecía sin límite.|Migración06 requiere estructura no nula, índices parciales y bounds. Consultas due/list/recover limitadas; recovery MATERIALIZED + SKIP LOCKED; ready exige accept confirmado. Claim token y journal transaccional conservados.|
|P1|Conciliación podía asumir moneda; sumas/cierres y reembolsos toleraban campos ambiguos.|Moneda explícita, enteros seguros, IDs/fechas válidos y coherencia de refund/pago/pedido. Duplicados visibles e informe inválido; ninguna venta corregida silenciosamente.|
|P1|CSP activa permitía unsafe-eval; dependencias dev tenían advisories.|Eliminado unsafe-eval, comprobado con documento real en Chromium y Supabase vendored. brace-expansion5.0.12 y uuid11.1.1 compatibles con xcode; audit incluye dev y runtime:0 reportadas. unsafe-inline sigue pendiente de CSP con nonce.|
|P2|Centro creaba clientes auth/timers repetidos y tenía textos ES mezclados.|Un cliente sin autoRefreshToken, timeout, verificación de sesión tardía; catálogo existente con74 entradas ES/PL/EN y selector accesible. Sin polling añadido; tres tamaños en navegador real.|
|P2|Intl.DateTimeFormat se construía para cada pedido de cierre.|Caché de8 zonas y lookup de pagos; memoria acotada y benchmark con2000 ventas.|

No se eliminaron archivos funcionales ni pruebas. Se mantuvieron los motores GitHub de pedidos, Stripe, cierres, cocina, repartidores y autenticación. app.js, mesero.js, colaborador.js y admin.js siguen byte idénticos a main. Cambios en cinco fuentes críticas se verifican con deltas reversibles y hash original, además de pruebas de comportamiento; no se reemplazaron por prototipos. www tiene42 assets iguales a la fuente y el service worker usa identidad nueva para evitar caché anterior.

## Alcance de auditoría y límites

AUDIT-INVENTORY.json inventaría contenido y SHA256 de cada archivo del proyecto, diferencias contra V5 y contra main y estructura de directorios. La revisión funcional profunda se centró en las rutas críticas anteriores, permisos/RLS de fixtures, Edge handlers y dependencias. No equivale a una prueba exhaustiva de cada ruta de interfaz o de una base desplegada. Todos los archivos SQL históricos se conservan; su numeración repetida preexistente requiere ledger y aplicación por dependencias, nunca glob alfabético.

Persisten bloqueos para producción: Supabase staging y dos TODO de mutación cruzada; conexiones PostgreSQL independientes; Stripe Connect/BLIK sandbox completo, reembolsos y settlement; contratos oficiales/autorización de los cinco proveedores; dispositivo POSNET físico/protocolo/PTU; GPS/push real; build APK, Deno typecheck y configuración de secretos/monitorización en staging. No se activó ninguna conexión ni cobro real. El auditor contable sigue read-only y no publica libros ni sustituye el cierre operativo.

Revisión contable pendiente de datos históricos NP que V5 hubiera clasificado ZW; no corregir automáticamente ventas/recibos existentes. Las categorías se preservan, no se decide qué IVA corresponde a cada producto. Referencia oficial consultada: https://ksef.podatki.gov.pl/media/jknpcymf/broszura-informacyjna-dotyczaca-struktury-logicznej-fa-3-04032026.pdf (tabla FA3 con zw, np I y np II). NP legacy no elige automáticamente subcategoría FA3.

Estado técnico: candidato consolidado de staging, con mejoras locales verificadas y sin fallos conocidos en las suites ejecutadas. No certificado listo para producción ni 100% libre de errores.

## Inventario real de la entrega

482 archivos inventariados por contenido; base V5 tenía457.414 permanecen idénticos a V5,43 modificados (incluidos docs/config/www),25 añadidos,0 eliminados en esta fase.362 archivos coinciden byte a byte con main. Las7 retiradas anteriores de la consolidación siguen justificadas en MERGE-REPORT; no son nuevas eliminaciones. Esta cifra no significa revisión manual exhaustiva de toda función.

332 casos Node y51 ejecuciones E2E pasan,0 fallos finales locales.7 casos staging bloqueados/omitidos y2 TODO no se consideran exitosos;1 suite Python auxiliar bloqueada. Ver los demás gates de hardware, pagos y conexiones reales. Rama local con commits revisables y serie de transferencia probada; publicación remota y PR bloqueados por403.

## Revisión adicional

Cola rechaza NaN/Infinity, reintentos nulos y budgets inválidos antes de iniciar. Conserva TTL personalizado finito, incluido fixture legacy de larga duración.

Dos probes de mutación ahora implementados con opt-in independiente y recuperación; no tocan finanzas. Auth staging validada en servidor, URLs normalizadas bloquean aliases de producción. Lecturas exigen datos existentes del propietario.7 nuevos casos locales pasan. Actual:339 Node,51 E2E,144 archivos de sintaxis;9 remotos SKIP,0 TODO. Cifras482/332 anteriores son históricas; AUDIT-INVENTORY y QA-RESULTS son el inventario actual.
