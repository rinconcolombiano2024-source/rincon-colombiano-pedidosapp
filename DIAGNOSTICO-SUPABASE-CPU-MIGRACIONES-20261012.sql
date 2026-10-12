-- RC ORDERA · 2026-10-12 · diagnóstico de alta CPU y migraciones.
-- SOLO LECTURA. No crea índices, no ejecuta dispatch, no altera cron,
-- no instala migraciones ni modifica pedidos, pagos, sesiones o datos.
-- Ejecutar en Supabase SQL Editor. Revisar el resultado antes de aplicar SQL.
-- NUNCA interpretar el número de versión fijo como prueba de migraciones aplicadas.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';

-- 1. Identidad de la base y actividad actual (muestra, no media de CPU).
SELECT current_database() AS database_name, clock_timestamp() AS collected_at,
       (SELECT count(*) FROM pg_stat_activity
         WHERE datname = current_database()) AS sessions,
       (SELECT count(*) FROM pg_stat_activity
         WHERE datname = current_database() AND state = 'active') AS active_sessions;

-- 2. Consultas ACTIVAS; no termina procesos ni reproduce SQL.
SELECT pid, backend_type, application_name, state, wait_event_type, wait_event,
       clock_timestamp() - query_start AS query_age,
       left(regexp_replace(coalesce(query, ''), '[[:space:]]+', ' ', 'g'), 180) AS query_excerpt
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid() AND state = 'active'
ORDER BY query_start ASC NULLS LAST
LIMIT 20;
-- Advertencia: ocultar emails, tokens o valores personales antes de compartir query_excerpt.

-- 3. Tablas que reciben lecturas secuenciales, cambios o acumulación de tuplas muertas.
SELECT schemaname, relname AS table_name, seq_scan, idx_scan,
       n_live_tup, n_dead_tup, n_tup_ins, n_tup_upd, n_tup_del,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (relname IN ('orders','customer_orders','delivery_assignments',
                   'customer_order_access_secrets','rc_delivery_outbox_v5')
       OR relname ILIKE '%dispatch%' OR relname ILIKE '%message%')
ORDER BY n_dead_tup DESC, seq_scan DESC
LIMIT 30;

-- 4. Funciones y componentes instalados: inventario; NO demuestra versión completa.
SELECT n.nspname AS schema_name, p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       md5(btrim(regexp_replace(p.prosrc, '\\s+', ' ', 'g'))) AS body_md5
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname ILIKE '%delivery%queue%'
       OR p.proname ILIKE '%dispatch%'
       OR p.proname ILIKE '%translation%quota%'
       OR p.proname ILIKE '%create_customer_order%'
       OR p.proname ILIKE '%release_contract%')
ORDER BY p.proname
LIMIT 80;

-- 5. Prerrequisitos detectables y extensiones de diagnóstico.
SELECT to_regclass('public.rc_delivery_outbox_v5') AS v5_outbox_table,
       to_regclass('public.rc_delivery_outbox_events_v5') AS v5_outbox_events,
       to_regprocedure('public.rc_ordera_process_delivery_queue(integer)') AS delivery_queue_rpc,
       to_regclass('cron.job') AS pg_cron_jobs_table,
       coalesce(to_regclass('extensions.pg_stat_statements'),
                to_regclass('public.pg_stat_statements')) AS query_stats_view;

SELECT extname, extversion FROM pg_extension
WHERE extname IN ('pg_cron','pg_stat_statements')
ORDER BY extname;

ROLLBACK;

-- 6. OPCIONAL, ejecutar por separado SOLO si aparece pg_stat_statements en el paso 5.
-- No ejecutar contra tablas grandes con EXPLAIN ANALYZE mientras CPU siga al 92%.
-- BEGIN READ ONLY;
-- SET LOCAL statement_timeout='5s';
-- SELECT calls, round(total_exec_time::numeric,1) AS total_ms,
--        round(mean_exec_time::numeric,2) AS mean_ms, rows,
--        left(regexp_replace(query, '[[:space:]]+', ' ', 'g'), 180) AS sql_excerpt
-- FROM extensions.pg_stat_statements
-- WHERE dbid = (SELECT oid FROM pg_database WHERE datname=current_database())
-- ORDER BY total_exec_time DESC LIMIT 15;
-- ROLLBACK;
--
-- 7. OPCIONAL, si existe cron.job y SQL Editor tiene permiso:
-- SELECT jobid, jobname, schedule, active, left(command, 240) AS command
-- FROM cron.job
-- WHERE command ILIKE '%rc_ordera%' OR jobname ILIKE '%ordera%'
-- ORDER BY jobid;
--
-- Siguiente paso: contrastar el resultado con V5-MIGRATIONS.json
-- y DEPLOYMENT-CHECKLIST.md. No aplicar 01..10 como lote indiscriminado;
-- algunos scripts reemplazan RPC y exigen MD5 exacto del cuerpo existente.
