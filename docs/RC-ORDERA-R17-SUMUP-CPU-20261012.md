# RC ORDERA R17 — SumUp y reducción segura de CPU (12-10-2026)

## Lo que aporta esta rama

- **SumUp:** inspección del webhook sin confiar en `status` ni `amount` enviados por un tercero; busca el intento previamente reservado y consulta directamente a SumUp por ID. El resultado `verified_only` es deliberadamente de **solo lectura**. No existe función HTTP activada ni se crean cobros, actualizaciones de pedido o liquidaciones.
- **CPU SQL:** optimización propuesta y reversible de cinco políticas RLS de alto tráfico; usa `(SELECT auth.uid())` para que PostgreSQL pueda evaluar la identidad una vez por consulta. Se comprueba que cada predicado actual siga siendo idéntico antes de alterar la política, abortando si cambió. No amplía acceso ni ejecuta SQL de producción.
- **Medición:** `DIAGNOSTICO-CPU-MUESTRA-R17.sql` registra contadores para comparar tasas por segundo entre dos muestras y cotejar con CPU del Dashboard. No confundir acumulados con porcentajes.

## Producción observada (solo lectura, 20:09–20:11 UTC)

Se observaron cero suscripciones en `realtime.subscription`; el único cron de reparto estaba inactivo; dos sesiones activas eran la consulta de diagnóstico y una conexión de replicación esperando WAL. `pg_stat_database.xact_rollback` se mantuvo en 1.291.201.366 en dos muestras; en ellas no había una tormenta activa de rollbacks. El contador histórico de `realtime.list_changes` sí aumentó, pero es acumulado. **No hay prueba de CPU instantánea al 93% ni de reducción porcentual.**

## Puertas para lanzamiento (NO AUTORIZA cobrar)

1. Staging: comparar `pg_policies`, ensayar acceso de restaurante, cliente, mesero y un usuario ajeno, RLS negativo; aplicar migración solo después.
2. Pasarela SumUp: clave API y merchant code empresariales autorizados en secretos de Supabase; pedido e intento persistidos en una operación transaccional; `return_url` y reconciliación idempotente; diferencia entre cobros del restaurante y Stripe Connect de marketplace.
3. Antes de producción: HTTPS, test de checkout PAID/PENDING/FAILED/EXPIRED y eventos duplicados, fallos de red, reembolsos y conciliación, pruebas end-to-end en ES/PL/EN, carga controlada y rollback.
4. Fiscal: el botón existe dentro del restaurante, pero autoriza puerto, no imprime fiscalmente. Falta modelo POSNET exacto y controlador/protocolo/hardware verificado.
5. Reparto: adaptadores internos sin credenciales/API oficiales de Glovo/Wolt/Uber Eats. No dar por conectados.
6. Esta rama no modifica `main`, datos locales ni `www`. No se habilitan pagos reales ni migraciones automáticas. Evitar scripts SQL históricos no auditados.

## Métrica real
Comparar tasa `calls/sec`, errores `40001/min`, conexiones y CPU del panel en intervalos equivalentes antes/después. Cualquier cambio inesperado de RLS implica restaurar predicados originales y no activar SumUp.
