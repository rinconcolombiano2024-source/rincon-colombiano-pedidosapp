-- RC ORDERA V91-12A
-- PREPARAR BOVEDA Y COMPARADOR DE TOKENS SIN CAMBIAR AUN EL FORMATO EN customer_orders.
-- Esta etapa es compatible con el backend viejo y permite desplegar marketplace-checkout antes del corte.

begin;

create extension if not exists pgcrypto;

do $preflight$
begin
  if to_regclass('public.customer_orders') is null then
    raise exception 'Falta public.customer_orders';
  end if;
  if has_table_privilege('authenticated', 'public.customer_orders', 'UPDATE') then
    raise exception 'V91-10 no esta aplicada: authenticated conserva UPDATE sobre customer_orders';
  end if;
end;
$preflight$;

create table if not exists public.customer_order_access_secrets (
  customer_order_id uuid primary key references public.customer_orders(id) on delete cascade,
  token_plaintext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_order_access_secrets_token_length_check
    check (length(token_plaintext) between 8 and 512)
);

alter table public.customer_order_access_secrets enable row level security;
revoke all on public.customer_order_access_secrets from public, anon, authenticated;

insert into public.customer_order_access_secrets (
  customer_order_id, token_plaintext, created_at, updated_at
)
select co.id, co.public_token, co.created_at, now()
from public.customer_orders co
where length(trim(coalesce(co.public_token, ''))) between 8 and 512
on conflict (customer_order_id) do nothing;

-- Comparador TRANSITORIO: funciona tanto con el plaintext actual como con SHA-256.
-- Solo service_role puede ejecutarlo, por lo que no se convierte en un oraculo publico.
create or replace function public.rc_ordera_customer_token_matches(
  p_order_id uuid,
  p_public_token text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    p_order_id is not null
    and length(trim(coalesce(p_public_token, ''))) between 8 and 512
    and exists (
      select 1
      from public.customer_orders co
      where co.id = p_order_id
        and (
          co.public_token = trim(p_public_token)
          or co.public_token = encode(digest(trim(p_public_token), 'sha256'), 'hex')
        )
    );
$$;

revoke all on function public.rc_ordera_customer_token_matches(uuid, text)
  from public, anon, authenticated;
grant execute on function public.rc_ordera_customer_token_matches(uuid, text)
  to service_role;

do $postcheck$
begin
  if has_table_privilege('authenticated', 'public.customer_order_access_secrets', 'SELECT')
     or has_table_privilege('anon', 'public.customer_order_access_secrets', 'SELECT') then
    raise exception 'SECURITY ERROR: la boveda es legible por clientes';
  end if;
  if has_function_privilege('authenticated', 'public.rc_ordera_customer_token_matches(uuid,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rc_ordera_customer_token_matches(uuid,text)', 'EXECUTE') then
    raise exception 'SECURITY ERROR: el comparador interno es invocable directamente';
  end if;
end;
$postcheck$;

commit;
notify pgrst, 'reload schema';
