-- New additive storage. Requires Supabase auth schema; never auto-applied.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
 IF to_regclass('auth.users') IS NULL THEN RAISE EXCEPTION 'Supabase auth.users required'; END IF;
END $$;
CREATE TABLE public.rc_delivery_outbox_v5 (
 id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{32}$'),
 restaurant_user_id uuid NOT NULL REFERENCES auth.users(id),
 entry jsonb NOT NULL CHECK (jsonb_typeof(entry)='object'),
 CHECK (entry->>'id' = id),
 CHECK (entry->>'restaurantId' = restaurant_user_id::text),
 CHECK (entry->>'state' IN ('pending','processing','sent','dead','expired','unknown')),
 CHECK (entry->>'provider' IN ('uber_eats','wolt','glovo','bolt_food','pyszne'))
);
CREATE UNIQUE INDEX rc_delivery_outbox_v5_command ON public.rc_delivery_outbox_v5(restaurant_user_id,(entry->>'provider'),(entry->>'orderId'),(entry->>'action'));
CREATE TABLE public.rc_delivery_outbox_events_v5 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 operation_id text NOT NULL REFERENCES public.rc_delivery_outbox_v5(id),
 restaurant_user_id uuid NOT NULL REFERENCES auth.users(id),
 event_type text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX rc_delivery_outbox_v5_tenant_state ON public.rc_delivery_outbox_v5(restaurant_user_id, (entry->>'state'));
ALTER TABLE public.rc_delivery_outbox_v5 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rc_delivery_outbox_events_v5 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rc_delivery_outbox_v5, public.rc_delivery_outbox_events_v5 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.rc_delivery_outbox_v5 TO service_role;
GRANT SELECT,INSERT ON public.rc_delivery_outbox_events_v5 TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.rc_delivery_outbox_events_v5_id_seq TO service_role;
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.rc_delivery_outbox_v5','UPDATE') THEN RAISE EXCEPTION 'outbox exposed'; END IF;
END $$;
COMMIT;
-- Recovery: disable workers; keep tables/journal; restore previous application commit.
-- Do not delete uncertain operations. Reconcile from provider evidence before restarting.
