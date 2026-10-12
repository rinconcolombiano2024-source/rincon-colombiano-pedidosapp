-- Read-only snapshot; execute twice during comparable real activity.
-- NOTE: historical totals are not CPU percent. Calculate deltas / elapsed seconds.
SELECT clock_timestamp() AS sampled_at, d.xact_commit, d.xact_rollback,
  d.blks_hit, d.blks_read, d.tup_fetched, d.tup_returned,
  (SELECT count(*) FROM realtime.subscription) AS active_realtime_subscriptions,
  (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
    AND state = 'active' AND wait_event_type IS DISTINCT FROM 'Client') AS active_sql_sessions
FROM pg_stat_database d WHERE d.datname = current_database();

SELECT queryid, calls, round(total_exec_time::numeric, 0) AS cumulative_ms,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  left(query, 180) AS query_excerpt
FROM pg_stat_statements
WHERE query ILIKE '%get_current_restaurant_delivery_tracking%'
   OR query ILIKE '%save_and_publish_restaurant_order_atomic%'
   OR query ILIKE '%list_changes%'
ORDER BY total_exec_time DESC LIMIT 20;
