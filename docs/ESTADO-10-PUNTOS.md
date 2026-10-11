> Última revisión: QA-CUARTA-MEJORA-20261011.md; 393 pruebas locales. CI de la tercera mejora aprobado. Hardware y verificaciones reales siguen pendientes.

> Última revisión: QA-TERCERA-MEJORA-20261011.md; 387 pruebas locales. CI de la segunda mejora aprobado. Hardware, servicios comerciales y pruebas reales siguen pendientes.

> Actualización 2026-10-11: consultar QA-SEGUNDA-MEJORA-20261011.md. La tabla siguiente conserva el contexto anterior. El borrador anterior 0350440 aprobó dos ejecuciones CI; esto no certifica conexiones externas. Diagnóstico autenticado de integraciones probado por el propietario. Supabase producción no recibió la migración compatible.

> Informe de consolidación V5 anterior. Estado actual y correcciones: HARDENING-REPORT.md y QA-REPORT.md. Las cifras anteriores son históricas; conexiones externas siguen pendientes.

# Estado verificado de los diez objetivos V5

|Objetivo|Estado y límite|
|---|---|
|Pedidos|RPC existente conservado y extensión idempotente/IVA probada en PostgreSQL local; falta staging real.|
|POS/cocina/meseros|Fuentes GitHub conservadas; suites de regresión locales; E2E requiere navegador.|
|Impresora fiscal|Puente y agente mock con journal persistente, claims, resultados idempotentes, UNKNOWN bloqueante. POSNET pendiente de modelo/protocolo oficial y prueba física. RC ORDERA es POS.|
|Apps de reparto|Cinco plantillas preservadas, no conectores comerciales certificados. Cola PostgreSQL nueva con token de reclamación. Default registry sigue cerrado.|
|Pagos|Motor existente único de Stripe conservado, regresiones simuladas; BLIK y sandbox Stripe pendientes de validación externa.|
|Contabilidad|Auditor offline read-only, no segundo motor POS: snapshots IVA, cantidades, duplicados, redondeo por documento, reembolsos con asignación IVA explícita. No publica cierres fiscales ni libros oficiales.|
|Repartidores|GPS/push/asignaciones originales conservados. Comparación de secreto reforzada; pendiente prueba real móvil.|
|Seguridad|RLS anterior conservado; cola privada y permisos nuevos probados localmente, CORS restringido. Falta revisar proyecto desplegado.|
|Administración|Centro de integraciones original ES/PL/EN conservado y incluido también en www. No presume conexiones verificadas.|
|Producción|Paquete y pruebas reproducibles. No desplegado; conexiones externas y E2E pendientes.|

No se asignan porcentajes de avance no medidos. Ver QA-REPORT.md y DEPLOYMENT-CHECKLIST.md.
