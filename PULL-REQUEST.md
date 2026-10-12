# RC ORDERA: consolidar V4/V5/V6 y reforzar integridad fiscal, financiera y colas

Objetivo: integrar en main las capacidades útiles del paquete manteniendo la arquitectura operativa. Ante respuestas perdidas, fiscal/reparto conservan UNKNOWN y requieren conciliación; pedidos mantienen ID/token y snapshots en reintentos. La cola SQL limita búsquedas y reclama mediante token tenant. Adaptadores sin contrato oficial permanecen bloqueados.

V6 añade editor IVA ES/PL/EN conservando NP/ZW y categorías desconocidas; conciliación por movimientos únicos e importes exactos; CSP de scripts sin unsafe-inline/eval; QR local; CLAIM_LOST sin abortar todo el lote. Se preservan las últimas guardas staging y de presupuestos de V5. Migraciones incrementales01..10, sin reemplazar las históricas;09 protege cuota global de traducción y10 evita heredar IVA cuando el producto tiene null explícito.

Validación local:370 tests Node,63 ejecuciones E2E (21×3 dispositivos),2324 i18n,159 sintaxis,45 activos www,10 IDs de migración;0 fallos. Python24 cargas y18 checks IVA; audit0 vulnerabilidades.9 pruebas Supabase live omitidas por fixtures/credenciales; PGlite no certifica conexiones PostgreSQL independientes. ZIP limpio con manifiesto y repetición registrada.

No habilita cobros, impresión física ni plataformas reales. Requiere revisión contable, staging PostgreSQL/Supabase, hardware/protocolo POSNET, Stripe/BLIK sandbox y contratos comerciales antes de producción. Adjuntos lógicos: MERGE-REPORT.md, QA-REPORT.md, DEPLOYMENT-CHECKLIST.md y V6-COMPARISON-MATRIX.json. Rama propuesta codex/rc-ordera-v6-consolidada-verificada; base2730150506122ae59ba142ca1ba84ec820acb301. Mantener PR draft; no auto-merge ni despliegue automático.
