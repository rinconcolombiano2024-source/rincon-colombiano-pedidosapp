-- Incremental correction. Never rewrites receipts or historical snapshots.
-- NP (outside Polish VAT), NP I/II, ZW (exemption), and 0 are distinct.
-- Device tax letters require verified device configuration; they are not rates.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
 IF to_regprocedure('public.rc_ordera_normalize_vat_rate(jsonb)') IS NULL THEN RAISE EXCEPTION 'Apply V5-02 first'; END IF;
END $$;
create or replace function public.rc_ordera_normalize_vat_rate(p jsonb)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case upper(btrim(coalesce(p #>> '{}', '')))
    when '23' then '23' when 'VAT_23' then '23'
    when '8'  then '8'   when 'VAT_8'  then '8'
    when '5'  then '5'   when 'VAT_5'  then '5'
    when '0'  then '0'   when 'VAT_0'  then '0'
    when 'ZW' then 'ZW' when 'EXEMPT' then 'ZW' when 'NP' then 'NP' when 'NP I' then 'NP I' when 'NP II' then 'NP II'
    else null
  end
$$;


REVOKE ALL ON FUNCTION public.rc_ordera_normalize_vat_rate(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rc_ordera_normalize_vat_rate(jsonb) TO service_role;
DO $$ BEGIN
 IF public.rc_ordera_normalize_vat_rate('"NP"') <> 'NP'
 OR public.rc_ordera_normalize_vat_rate('"ZW"') <> 'ZW'
 OR public.rc_ordera_normalize_vat_rate('"A"') IS NOT NULL
 THEN RAISE EXCEPTION 'VAT normalization postcondition failed'; END IF;
END $$;
COMMIT;
-- Recovery: restore previous application, keep this corrected helper. No down-migration
-- to NP=>ZW. Historical suspect snapshots require accountant review, never auto-rewrite.
