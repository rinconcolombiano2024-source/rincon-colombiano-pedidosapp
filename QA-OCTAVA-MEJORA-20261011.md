# Octava mejora — recuperación fiscal sin duplicación

Base remota 85038e36a8b4503873236c1e93578fd610bdb11c. Ambos CI de esa revisión aprobaron. Rama codex/rc-ordera-fusion-v6; main y producción sin cambios.

Defectos reproducidos: (1) una reclamación repetida de una operación aún UNKNOWN podía sobrescribir su diario y volver a imprimir; (2) el resultado conciliado se reportaba antes de persistirse, perdiendo evidencia si el proceso caía en ese intervalo. Además, un registro histórico phase=unknown sin outcome se omitía en el reporte.

Corrección localizada en el agente existente: guardar el resultado conciliado antes de reportarlo; si falla persistencia, no reportar ni reclamar; conservar un conjunto de IDs pendientes durante recuperación y rechazar su reasignación con JOURNAL_OPERATION_PENDING antes de mark_sending o impresión. UNKNOWN histórico se normaliza al reportar. No se crea un segundo motor ni polling nuevo.

Pruebas: cuatro nuevas regresiones de reasignación UNKNOWN, persistencia antes de reporte, fallo de disco y compatibilidad histórica. Las tres primeras reprodujeron fallos contra el código anterior. Durante desarrollo se ajustó la aserción del error a su propiedad code (FiscalError separa code/message), manteniendo el rechazo y la prohibición de impresión. Suite local final: 408 casos aprobados, cero fallidos. Se repite instalación y QA desde extracción limpia para la entrega; las verificaciones externas omitidas no se cuentan como aprobadas. qa:policy conserva 45 fuentes www y diez IDs V5.

Recuperación operativa: JOURNAL_OPERATION_PENDING exige conciliar la identidad ya registrada; no borrar su diario ni crear otro ID para forzar emisión. Un fallo de disco requiere reparar almacenamiento y preservar evidencia antes de reiniciar. No aplicar migraciones por esta corrección. Revertir el commit no cambia el formato del diario, pero reintroduce los riesgos descritos.

Límites: el diario no sustituye la idempotencia del servidor. Tras confirmar y retirar un registro local, corresponde al servidor impedir su reasignación. El lock es local; varios agentes requieren reclamación exclusiva en servidor. Pruebas locales simuladas no certifican hardware, API comercial ni concurrencia PostgreSQL independiente. Nueve pruebas Supabase sin staging siguen pendientes, E2E local bloqueado por Chromium; CI ejecuta navegador. No se midió CPU/memoria ni se activaron pagos/fiscalización/reparto real.

Estado de los diez objetivos en docs/ESTADO-10-PUNTOS.md. Migración compatible preparada, no aplicada: DEPLOYED-COMPAT-20261011.md. Instalar con npm ci --ignore-scripts --no-audit --no-fund; npm run qa; sha256sum -c MANIFEST-SHA256.txt.
