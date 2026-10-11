# Estado de los diez objetivos — 2026-10-11

Última revisión: QA-QUINTA-MEJORA-20261011.md. 396 pruebas locales; las verificaciones externas pendientes no se cuentan como aprobadas. Los dos CI de la cuarta mejora aprobaron; comprobar los de esta revisión. Sin porcentaje global de funcionamiento.

|Objetivo|Evidencia actual|Pendiente para aprobar producción|
|---|---|---|
|1 Pedidos|Idempotencia, cantidades y compatibilidad RPC probadas localmente; controles preservados.|Aplicar únicamente ruta SQL revisada en staging; probar clientes y concurrencia real.|
|2 POS/cocina/meseros|Módulos conservados y regresiones automatizadas.|Flujo multidispositivo, desconexión y estados con roles reales.|
|3 Impresora fiscal|UNKNOWN protegido; diario persistente; acuses estrictos; simulación identificada.|Modelo POSNET, protocolo oficial, controlador y hardware. SQL fiscal faltante por verificar/aplicar en staging.|
|4 Reparto externo|Adaptadores preparados, outbox SQL atómica; selección evita bloqueo por ready no ejecutable.|Acceso y contratos oficiales, webhooks y workers en staging; concurrencia independiente.|
|5 Pagos|Motor Stripe conservado; regresiones simuladas; reembolsos trazables.|Stripe test, webhooks reales de prueba, BLIK elegibilidad y liquidaciones.|
|6 Contabilidad|Dinero exacto, duplicados, reembolsos netos, snapshots y cantidades auditados.|IVA completo de datos reales, cierres integrales y revisión contable.|
|7 Repartidores|Módulos GPS/asignación/push conservados.|Móvil real, permisos negativos, recuperación y notificaciones.|
|8 Seguridad/recursos|CSP, límites, aislamiento SQL local, tokens y CI de dependencias.|RLS negativo en proyecto de pruebas, concurrencia real y medición CPU/memoria.|
|9 Administración|Centro ES/PL/EN conservado; propietario comprobó diagnóstico autenticado.|Gestión operativa oficial, navegación y pruebas UI con cuentas reales.|
|10 Producción|Borrador y ZIP alineados, manifiesto, instalación y QA limpio.|Staging, pruebas externas, migraciones controladas, monitoreo/rollback autorizado.|

Main no se modifica; no hay nuevas acciones de producción. Consultar DEPLOYED-COMPAT-20261011.md: migración preparada pero no aplicada. No ejecutar archivos SQL históricos en bloque. Los informes incrementales anteriores son evidencia histórica, no certificación de esta revisión.
