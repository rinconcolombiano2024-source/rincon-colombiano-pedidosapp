# Tercera mejora incremental — 2026-10-11

Base remota: e91554710f6fce186b6a93da9b097fdb3c0cc68d, codex/rc-ordera-fusion-v6. Sus dos ejecuciones CI aprobaron. Main y Supabase producción intactos.

Defectos reproducidos: fromGrosz(1.5) devolvía 0.1.5; una multiplicación fuera del rango seguro podía formatearse sin rechazo; un artículo sin precio ni total_snapshot se convertía en 0.00.

Correcciones: minor units deben ser enteros seguros; formato mediante BigInt conserva exactamente los límites y signos. El adaptador exige precio o snapshot, rechaza importes negativos, overflow y alias quantity/qty contradictorios. Precios explícitos cero y snapshots legítimos se conservan. No se modifica el motor de pagos, los pedidos persistidos ni los cierres operativos. Un dato inválido produce AccountingError, nunca una cifra inventada.

QA: 387 pruebas locales aprobadas, cero fallidas. Tres nuevos casos contienen límites monetarios, datos inválidos y cantidades/precios válidos. qa:policy verifica 161 archivos sintácticos, 45 fuentes www iguales y diez IDs V5. npm audit reporta cero vulnerabilidades. qa:integration: nueve omitidas sin entorno de pruebas. Se repite instalación y QA desde ZIP limpio. E2E local sigue bloqueado por Chromium; CI del borrador ejecuta matriz. No se midió CPU ni se certificó concurrencia real o servicios externos.

Objetivos reforzados: identidad/cantidades de pedidos (1), contabilidad (6), validación de datos (8), entrega (10). Los demás conservan lo implementado: POS/cocina/meseros y repartidores requieren pruebas multidispositivo; fiscal y reparto comercial requieren protocolos/hardware/acceso oficial; pagos requieren Stripe sandbox; administración conserva diagnóstico autenticado. SQL compatible incluido pero no aplicado. Sin porcentaje global de fiabilidad.

Instalar: npm ci --ignore-scripts --no-audit --no-fund; npm run qa; sha256sum -c MANIFEST-SHA256.txt. Revisar también DEPLOYED-COMPAT-20261011.md y DEPLOYMENT-CHECKLIST.md. No aplicar migraciones automáticamente. Para revertir este bloque de código, revertir el commit con frontend/servicios detenidos cuando corresponda; no eliminar datos ni journal fiscal.
