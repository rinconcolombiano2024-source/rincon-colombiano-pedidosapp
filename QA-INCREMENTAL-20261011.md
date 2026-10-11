# Verificación incremental — 2026-10-11

Base remota: 2b24ab7e479f4af1ab0f0466a40151fa5154e5dd; rama codex/rc-ordera-fusion-v6. Main y producción sin modificar.

Cambios: sesión del centro sincronizada con restaurante; mapa fiscal explícito e inmutable que rechaza tasas numéricas contradictorias; CI bloquea vulnerabilidades altas/críticas en todas las dependencias; migración incremental con huellas verificadas conserva controles de empaque y añade bloqueo compartido por pedido. No se eliminaron capacidades ni pruebas.

QA: npm run qa, 378 casos aprobados, cero fallidos. Política: 161 archivos de sintaxis, 45 fuentes distribuidas iguales, 10 identificadores V5 comprobados. npm audit: cero vulnerabilidades reportadas. Supabase: 9 pruebas omitidas por falta de entorno de pruebas. E2E bloqueado: instalación de Chromium truncada en este entorno, no se presenta como aprobado. Concurrencia SQL embebida comprobada; conexiones PostgreSQL independientes pendientes. Sin medición nueva de CPU.

Los informes V6 previos se conservan como evidencia histórica; este informe describe la nueva ejecución. No certifica hardware, Stripe/BLIK ni proveedores comerciales. La migración NO se ejecutó en Supabase; consultar DEPLOYED-COMPAT-20261011.md antes de cualquier aplicación. No ejecutar ciegamente migraciones 02/07.

Despliegue: revisar PR, validar staging con roles reales y pedidos ficticios, validar funciones y ACL, revisar permisos/IVA, obtener autorización antes de cambios de producción. Mantener adaptadores reales bloqueados hasta validación oficial. Recuperación SQL: exportar definiciones/ACL antes de aplicar y restaurarlas en ventana controlada si fuera necesario.
