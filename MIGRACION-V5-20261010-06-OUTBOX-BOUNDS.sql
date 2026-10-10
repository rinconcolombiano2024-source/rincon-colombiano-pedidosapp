-- V5-03 prerequisite. Validate existing entries; abort rather than remove invalid history.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF to_regclass('public.rc_delivery_outbox_v5') IS NULL THEN RAISE EXCEPTION 'Apply V5-03 first'; END IF;
END $$;
ALTER TABLE public.rc_delivery_outbox_v5 ADD CONSTRAINT rc_delivery_outbox_required_fields CHECK (coalesce((
 entry ?& ARRAY['id','restaurantId','state','provider','orderId','action','createdAt','nextAttemptAt','deadlineAt','attempts','payload']
 AND jsonb_typeof(entry->'payload')='object'
 AND coalesce(entry->>'orderId','')<>'' AND length(entry->>'orderId')<=200
 AND coalesce(entry->>'action','') IN ('accept','reject','ready','delivered','cancel')
 AND jsonb_typeof(entry->'createdAt')='number' AND (entry->>'createdAt') ~ '^\d{1,16}$'
 AND jsonb_typeof(entry->'nextAttemptAt')='number' AND (entry->>'nextAttemptAt') ~ '^\d{1,16}$'
 AND jsonb_typeof(entry->'deadlineAt')='number' AND (entry->>'deadlineAt') ~ '^\d{1,16}$'
 AND jsonb_typeof(entry->'attempts')='number' AND (entry->>'attempts') ~ '^\d{1,6}$'
 AND (entry->>'state'<>'processing' OR (entry ?& ARRAY['claimToken','leaseUntil']
   AND coalesce(entry->>'claimToken','')<>'' AND jsonb_typeof(entry->'leaseUntil')='number'
   AND (entry->>'leaseUntil') ~ '^\d{1,16}$'))
), false));
CREATE INDEX rc_delivery_outbox_pending_v5 ON public.rc_delivery_outbox_v5 (
 restaurant_user_id,
 (CASE entry->>'action' WHEN 'accept' THEN 0 WHEN 'reject' THEN 0 WHEN 'ready' THEN 1 WHEN 'delivered' THEN 2 ELSE 9 END),
 ((entry->>'createdAt')::bigint),id
) WHERE entry->>'state'='pending';
CREATE INDEX rc_delivery_outbox_recovery_v5 ON public.rc_delivery_outbox_v5(restaurant_user_id,((entry->>'leaseUntil')::bigint),id)
 WHERE entry->>'state'='processing';
CREATE INDEX rc_delivery_outbox_pages_v5 ON public.rc_delivery_outbox_v5(restaurant_user_id,id);
CREATE INDEX rc_delivery_outbox_events_tenant_v5 ON public.rc_delivery_outbox_events_v5(restaurant_user_id,created_at,id);
DO $$ BEGIN
 IF NOT (select convalidated from pg_constraint where conname='rc_delivery_outbox_required_fields' AND conrelid='public.rc_delivery_outbox_v5'::regclass)
 THEN RAISE EXCEPTION 'Outbox validation failed'; END IF;
END $$;
COMMIT;
-- Recovery: stop workers, preserve tables/events/UNKNOWN. Restore previous app.
-- Keep additive indexes/constraints. For large staging tables use reviewed CONCURRENTLY
-- index build outside transaction; these scripts impose 5s lock/30s statement budgets.
