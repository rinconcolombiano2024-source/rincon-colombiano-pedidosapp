# Quinta mejora incremental — 2026-10-11

Base 0438ee5003af033d5761002c41b92d120220fa86; sus dos CI aprobaron. Rama codex/rc-ordera-fusion-v6. Main y producción intactos.

Defecto: due seleccionaba ready aunque accept estuviera processing o pendiente con nextAttemptAt futuro. claim rechazaba ready correctamente, pero el candidato ocupaba una plaza del lote; con batchSize=1 podía retrasar indefinidamente comandos ejecutables de menor prioridad.

Corrección: due solo considera ready con accept sent o pending ya vencido para este lote. Esto conserva envío accept→ready en el mismo lote cuando es posible. Claim mantiene requisito accept sent. No se reencolan UNKNOWN, no cambian leases/tokens, no se amplía batchSize y no hay polling nuevo. MemoryOutboxStore aplica la misma regla.

Validación: 396 pruebas locales aprobadas, cero fallidas. Tres nuevas pruebas verifican lote SQL de tamaño uno sin bloqueo por aceptación diferida, aceptación processing que libera ready tras sent, y paridad del store de pruebas. SQL ejecutado en PGlite; no certifica conexiones PostgreSQL independientes. qa:policy: 162 archivos sintácticos, 45 fuentes www iguales y diez IDs V5. Instalación/QA se repiten desde ZIP limpio; manifiesto y todos los blobs se comparan con GitHub.

Sin nueva medición CPU: se evita una selección inútil en el escenario reproducido, no se declara un porcentaje de mejora. Nueve pruebas reales Supabase continúan pendientes sin entorno. E2E local sigue bloqueado por Chromium; CI ejecuta matriz. Sin hardware, pagos reales ni plataformas comerciales.

Refuerza reparto (4), procesamiento y seguridad (8), recuperación/producción (10). docs/ESTADO-10-PUNTOS.md describe límites actuales. Instalar con npm ci --ignore-scripts --no-audit --no-fund; npm run qa; sha256sum -c MANIFEST-SHA256.txt. No aplicar SQL automáticamente. Para revertir este bloque, revertir commit y detener workers durante cambio; conservar datos y UNKNOWN. La reversión restaura el bloqueo de lote descrito.
