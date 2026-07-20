create table if not exists public.account_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (
    request_type in (
      'account_deactivation',
      'account_deletion',
      'restaurant_closure',
      'restaurant_deletion',
      'courier_deactivation',
      'customer_deletion'
    )
  ),
  role_context text not null default '',
  status text not null default 'requested' check (
    status in ('requested', 'in_review', 'approved', 'rejected', 'completed', 'cancelled')
  ),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_privacy_requests enable row level security;

drop policy if exists "Users create own privacy requests" on public.account_privacy_requests;
create policy "Users create own privacy requests"
on public.account_privacy_requests
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users read own privacy requests" on public.account_privacy_requests;
create policy "Users read own privacy requests"
on public.account_privacy_requests
for select
using (auth.uid() = user_id);

drop policy if exists "Platform admins manage privacy requests" on public.account_privacy_requests;
create policy "Platform admins manage privacy requests"
on public.account_privacy_requests
for all
using (public.user_has_active_role('platform_admin'))
with check (public.user_has_active_role('platform_admin'));

grant select, insert on public.account_privacy_requests to authenticated;

create index if not exists restaurant_profiles_active_business_name_idx
on public.restaurant_profiles (active, lower(trim(business_name)));
