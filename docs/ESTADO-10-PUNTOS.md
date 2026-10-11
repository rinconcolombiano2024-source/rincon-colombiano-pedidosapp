# Estado de los diez objetivos — 2026-10-12

Última revisión: QA-DECIMOQUINTA-MEJORA-20261012.md. 455 pruebas locales y 99 E2E aprobadas en CI sobre el código sincronizado. Nueve pruebas Supabase TEST omitidas. Sin porcentaje global de funcionamiento.

|Objetivo|Evidencia actual|Pendiente para aprobar producción|
|---|---|---|
|1 Pedidos|Envío completo bloqueado, carrito estable, identidad de cuenta/restaurante revisada tras guardar perfil; idempotencia, cantidades y compatibilidad RPC probadas localmente.|Aplicar únicamente ruta SQL revisada en staging; probar clientes y concurrencia real.|
|2 POS/cocina/meseros|Módulos conservados y regresiones automatizadas.|Flujo multidispositivo, desconexión y estados con roles reales.|
|3 Impresora fiscal|UNKNOWN protegido frente a reasignación; conciliación persistida antes de reporte; diario persistente validado y bloqueo ante corrupción; acuses estrictos; simulación identificada.|Modelo POSNET, protocolo oficial, controlador y hardware. SQL fiscal faltante por verificar/aplicar en staging.|
|4 Reparto externo|Importes externos exactos, adaptadores preparados, outbox SQL atómica; selección evita bloqueo por ready no ejecutable; redirecciones bloqueadas y resultado incierto sin reenvío automático.|Acceso y contratos oficiales, webhooks y workers en staging; concurrencia independiente.|
|5 Pagos|Motor Stripe conservado; regresiones simuladas; reembolsos trazables.|Stripe test, webhooks reales de prueba, BLIK elegibilidad y liquidaciones.|
|6 Contabilidad|Dinero exacto, duplicados, reembolsos netos, snapshots y cantidades auditados.|IVA completo de datos reales, cierres integrales y revisión contable.|
|7 Repartidores|Módulos GPS/asignación/push conservados.|Móvil real, permisos negativos, recuperación y notificaciones.|
|8 Seguridad/recursos|CSP, límites de cuerpos en gateway/cancelaciones, aislamiento SQL local; caché estática canónica acotada y notificaciones restringidas al colaborador.|RLS negativo en proyecto de pruebas, concurrencia real y medición CPU/memoria.|
|9 Administración|Descarga PWA con manifiestos ES/PL/EN del portal y estados de instalación precisos, visible en portal/cliente/colaborador; centro ES/PL/EN con espaciado y nombres accesibles traducidos; propietario comprobó diagnóstico autenticado; controles táctiles de 44 px y prueba a 320 px.|Gestión operativa oficial, navegación y pruebas UI con cuentas reales.|
|10 Producción|Borrador y ZIP alineados, manifiesto, instalación y QA limpio.|Staging, pruebas externas, migraciones controladas, monitoreo/rollback autorizado.|

Main no se modifica; no hay nuevas acciones de producción. Consultar DEPLOYED-COMPAT-20261011.md: migración preparada pero no aplicada. No ejecutar archivos SQL históricos en bloque. Los informes incrementales anteriores son evidencia histórica, no certificación de esta revisión.
