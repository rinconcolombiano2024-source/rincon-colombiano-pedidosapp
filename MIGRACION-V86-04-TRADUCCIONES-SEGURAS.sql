-- RC ORDERA V86.04
-- Cache y limite de uso para traducciones dinamicas mediante Edge Function.
-- La clave del proveedor se guarda como secreto y nunca en estas tablas.

begin;

create table if not exists public.public_content_translations (
  source_hash text not null,
  target_language text not null check (target_language in ('es', 'pl', 'en')),
  source_text text not null check (char_length(source_text) between 1 and 500),
  translated_text text not null check (char_length(translated_text) between 1 and 1000),
  provider text not null default 'google_cloud_translation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_hash, target_language)
);

create table if not exists public.translation_request_limits (
  client_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.public_content_translations enable row level security;
alter table public.translation_request_limits enable row level security;
revoke all on table public.public_content_translations from public, anon, authenticated;
revoke all on table public.translation_request_limits from public, anon, authenticated;

create or replace function public.rc_ordera_consume_translation_quota(
  p_client_hash text,
  p_hourly_limit integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_hash text := left(trim(coalesce(p_client_hash, '')), 128);
  v_count integer;
begin
  if length(v_hash) < 16 then return false; end if;

  insert into public.translation_request_limits (
    client_hash, window_started_at, request_count, updated_at
  ) values (
    v_hash, now(), 1, now()
  ) on conflict (client_hash) do update set
    window_started_at = case
      when translation_request_limits.window_started_at <= now() - interval '1 hour' then now()
      else translation_request_limits.window_started_at
    end,
    request_count = case
      when translation_request_limits.window_started_at <= now() - interval '1 hour' then 1
      else translation_request_limits.request_count + 1
    end,
    updated_at = now()
  returning request_count into v_count;

  return v_count <= least(greatest(coalesce(p_hourly_limit, 120), 10), 500);
end;
$$;

revoke all on function public.rc_ordera_consume_translation_quota(text, integer) from public, anon, authenticated;
grant execute on function public.rc_ordera_consume_translation_quota(text, integer) to service_role;

notify pgrst, 'reload schema';

commit;
