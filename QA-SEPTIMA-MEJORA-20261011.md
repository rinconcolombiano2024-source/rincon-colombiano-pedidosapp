# Séptima mejora — diario fiscal persistente

Base remota f4eb9c91e60385ea14198c0421a853e10ee5a15e; ambos CI de esa revisión aprobaron. Rama codex/rc-ordera-fusion-v6; sin cambios en main ni producción.

Defecto reproducido antes de corregir: un archivo con [] aceptaba put({operationId:'op',phase:'unknown'}) y seguía conteniendo []; list devolvía cero operaciones. Además, __proto__ se interpretaba como prototipo al escribir sobre un objeto ordinario.

Corrección localizada: validar raíz, identidad, fase y resultados del diario; usar un diccionario sin prototipo; rechazar desaparición de un archivo ya observado durante el proceso. Un diario corrupto no se sobrescribe ni se interpreta como vacío. El agente falla antes de reclamar trabajo. Se preservan bloqueo exclusivo local, escritura atómica, fsync y recuperación sin reimpresión automática.

Validación local final: npm run qa aprobó 404 casos, cero fallidos; cinco pruebas nuevas de corrupción, identidades especiales/reinicio, desaparición, escritura inválida y bloqueo del agente. Una primera ejecución detectó orden incorrecto en la limpieza de la nueva prueba de reinicio; se corrigió su cleanup sin modificar criterios. qa:policy: 163 archivos de sintaxis, 45 copias www sincronizadas, diez identificadores V5. Repetir instalación/QA y manifiesto desde el ZIP limpio forma parte de la entrega.

Límites: validación estructural no es protección criptográfica contra manipulación ni detecta la eliminación del diario antes de iniciar un proceso nuevo. Mantener copia segura y conciliación servidor/dispositivo. Nunca eliminar un diario o su lock para forzar una impresión. Ante JOURNAL_*_RECONCILE_REQUIRED: detener agente, preservar archivo y lock, revisar historial servidor/dispositivo con operador autorizado y restaurar copia verificada; no sustituir por {}. Rollback de código no repara un diario dañado.

Las nueve pruebas reales Supabase siguen sin entorno autorizado. Hardware POSNET, proveedores comerciales, Stripe test, concurrencia PostgreSQL independiente y mediciones CPU/memoria siguen pendientes. E2E local bloqueado por descarga de Chromium; CI de esta revisión se revisa separadamente. No certificar producción por estos resultados. Consultar docs/ESTADO-10-PUNTOS.md y DEPLOYED-COMPAT-20261011.md antes de cualquier migración.

Instalar: npm ci --ignore-scripts --no-audit --no-fund; npm run qa; sha256sum -c MANIFEST-SHA256.txt. Sin migraciones nuevas en esta mejora.
