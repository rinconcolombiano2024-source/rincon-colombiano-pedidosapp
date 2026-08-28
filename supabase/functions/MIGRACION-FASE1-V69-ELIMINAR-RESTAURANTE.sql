-- RC ORDERA V69
-- Corrige el cierre/eliminacion logica de restaurantes.
-- No borra restaurantes, pedidos, menus, reportes ni usuarios.

begin;

create or replace function public.set_current_restaurant_active(p_active boolean)
returns table (
  restaurant_user_id uuid,
  restaurant_active boolean,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_name text := 'Restaurante';
  v_logo_url text := '';
  v_public_address text := '';
  v_phone text := '';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.restaurant_profiles rp where rp.user_id = v_user_id
  ) and not exists (
    select 1 from public.app_settings s where s.user_id = v_user_id
  ) then
    raise exception 'Restaurant profile not found';
  end if;

  select
    coalesce(nullif(trim(s.settings->>'businessName'), ''), 'Restaurante'),
    coalesce(s.settings->>'businessLogoUrl', ''),
    coalesce(nullif(trim(s.settings->>'restaurantAddress'), ''), nullif(trim(s.settings->>'legalAddress'), ''), ''),
    coalesce(s.settings->>'businessPhone', '')
  into
    v_business_name,
    v_logo_url,
    v_public_address,
    v_phone
  from public.app_settings s
  where s.user_id = v_user_id;

  insert into public.restaurant_profiles (
    user_id,
    business_name,
    logo_url,
    public_address,
    phone,
    active,
    updated_at
  )
  values (
    v_user_id,
    coalesce(nullif(trim(v_business_name), ''), 'Restaurante'),
    coalesce(v_logo_url, ''),
    coalesce(v_public_address, ''),
    coalesce(v_phone, ''),
    p_active,
    now()
  )
  on conflict (user_id)
  do update set
    active = excluded.active,
    updated_at = now();

  update public.app_settings
  set
    settings = coalesce(settings, '{}'::jsonb)
      || jsonb_build_object('restaurantActive', p_active),
    updated_at = now()
  where user_id = v_user_id;

  return query
  select rp.user_id, rp.active, rp.updated_at
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;
end;
$$;

create or replace function public.request_current_restaurant_deletion()
returns table (
  restaurant_user_id uuid,
  restaurant_active boolean,
  changed_at timestamptz,
  privacy_request_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_business_name text := '';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.set_current_restaurant_active(false);

  select rp.business_name
  into v_business_name
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;

  select apr.id
  into v_request_id
  from public.account_privacy_requests apr
  where apr.user_id = v_user_id
    and apr.request_type = 'restaurant_deletion'
    and apr.status in ('requested', 'in_review')
  order by apr.created_at desc
  limit 1;

  if v_request_id is null then
    insert into public.account_privacy_requests (
      user_id,
      request_type,
      role_context,
      status,
      details
    )
    values (
      v_user_id,
      'restaurant_deletion',
      'restaurant_owner',
      'requested',
      jsonb_build_object(
        'businessName', coalesce(v_business_name, ''),
        'requestedAt', now()
      )
    )
    returning id into v_request_id;
  end if;

  return query
  select rp.user_id, rp.active, rp.updated_at, v_request_id
  from public.restaurant_profiles rp
  where rp.user_id = v_user_id;
end;
$$;

create or replace function public.get_public_restaurant_menu(p_user_id uuid)
returns table(menu jsonb, settings jsonb)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(s.menu, '{}'::jsonb) as menu,
    jsonb_strip_nulls(
      jsonb_build_object(
        'businessName', coalesce(nullif(s.settings->>'businessName', ''), nullif(rp.business_name, ''), 'Restaurante'),
        'businessLogoUrl', coalesce(nullif(s.settings->>'businessLogoUrl', ''), nullif(rp.logo_url, '')),
        'currencySymbol', s.settings->>'currencySymbol',
        'currencyPosition', s.settings->>'currencyPosition',
        'moneyFormat', s.settings->>'moneyFormat',
        'deliveryFee', s.settings->'deliveryFee',
        'deliveryMinimumFee', s.settings->'deliveryMinimumFee',
        'restaurantAddress', s.settings->>'restaurantAddress',
        'googleMapsApiKey', s.settings->>'googleMapsApiKey',
        'bankAccount', s.settings->>'bankAccount',
        'bankTransferNote', s.settings->>'bankTransferNote',
        'restaurantActive', rp.active
      )
    ) as settings
  from public.app_settings s
  join public.restaurant_profiles rp
    on rp.user_id = s.user_id
   and rp.active = true
  where s.user_id = p_user_id
  limit 1;
$$;

revoke all on function public.set_current_restaurant_active(boolean) from public;
revoke all on function public.request_current_restaurant_deletion() from public;
grant execute on function public.set_current_restaurant_active(boolean) to authenticated;
grant execute on function public.request_current_restaurant_deletion() to authenticated;
grant execute on function public.get_public_restaurant_menu(uuid) to anon, authenticated;

commit;

-- Verificacion opcional despues de ejecutar:
-- select user_id, business_name, active, updated_at
-- from public.restaurant_profiles
-- order by updated_at desc;
