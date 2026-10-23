-- Logical revision conflicts are not serialization failures. PostgREST 14 can
-- retry custom 40001 errors indefinitely. Preserve all locks, guards and writes.
-- Only the exact inspected function body is accepted; reruns are idempotent.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
DO $patch$
DECLARE
  target regprocedure := to_regprocedure('public.save_restaurant_order_atomic_strict(uuid,integer,date,jsonb,numeric,timestamptz,bigint)');
  before_hash text;
  definition text;
  after_hash text;
BEGIN
  IF target IS NULL THEN RAISE EXCEPTION 'STRICT_REVISION_RPC_MISSING'; END IF;
  SELECT md5(replace(prosrc,chr(13),'')),pg_get_functiondef(oid)
    INTO before_hash,definition FROM pg_proc WHERE oid=target;
  IF before_hash = '48e8022cc75b15d05c711bec50bc2a2c' THEN RETURN; END IF;
  IF before_hash <> '7d5344e09876deab220e1e2fdba5157a' THEN
    RAISE EXCEPTION 'STRICT_REVISION_RPC_DRIFT: %',before_hash;
  END IF;
  -- CREATE OR REPLACE retains the existing owner, ACL, signature and attributes.
  EXECUTE replace(definition, 'errcode = ''40001''', 'errcode = ''P0001''');
  SELECT md5(replace(prosrc,chr(13),'')) INTO after_hash FROM pg_proc WHERE oid=target;
  IF after_hash <> '48e8022cc75b15d05c711bec50bc2a2c' THEN
    RAISE EXCEPTION 'STRICT_REVISION_PATCH_MISMATCH';
  END IF;
END;
$patch$;
