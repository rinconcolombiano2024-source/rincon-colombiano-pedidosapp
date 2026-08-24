-- RC ORDERA V86
-- Cierre atomico del perfil restaurante sin borrar pedidos, pagos ni otros roles del usuario.
-- La funcion solo puede invocarse desde la Edge Function, despues de revalidar la identidad.

begin;

create or replace function public.rc_ordera_finalize_restaurant_deletion(p_user_id uuid)
returns table(
  restaurant_user_id uuid,
  hidden_from_customers boolean,
  account_preserved boolean,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile public.restaurant_profiles%rowtype;
  v_changed_at timestamptz := now();
begin
  if p_user_id is null then raise exception 'Restaurant user is required'; end if;
  if public.rc_ordera_is_platform_admin(p_user_id) then
    raise exception 'Platform administrator cannot be deleted from restaurant panel';
  end if;

  select rp.* into v_profile
  from public.restaurant_profiles rp
  where rp.user_id = p_user_id
  for update;
  if not found then raise exception 'Restaurant profile not found'; end if;

  if exists (
    select 1
    from public.customer_orders co
    where co.user_id = p_user_id
      and coalesce(nullif(co.canonical_status, ''), co.status, 'pending')
          not in ('delivered', 'completed', 'cancelled', 'rejected', 'refunded')
  ) then
    raise exception 'Restaurant has active orders';
  end if;

  if exists (
    select 1
    from public.marketplace_payment_allocations mpa
    where mpa.restaurant_user_id = p_user_id
      and mpa.status not in ('settled', 'refunded')
  ) then
    raise exception 'Restaurant has pending payment settlements';
  end if;

  update public.restaurant_profiles
  set active = false,
      operational_open = false,
      operational_mode = 'manual',
      deleted_at = coalesce(deleted_at, v_changed_at),
      updated_at = v_changed_at
  where user_id = p_user_id;

  update public.app_settings
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'restaurantActive', false,
        'restaurantOperationalOpen', false,
        'restaurantOperationalMode', 'manual',
        'restaurantDeletedAt', v_changed_at
      ),
      updated_at = v_changed_at
  where user_id = p_user_id;

  update public.restaurant_public_catalogs
  set active = false,
      operational_open = false,
      updated_at = v_changed_at,
      revision = revision + 1
  where restaurant_user_id = p_user_id;

  update public.restaurant_staff_memberships
  set active = false,
      updated_at = v_changed_at
  where restaurant_user_id = p_user_id
    and active = true;

  update public.restaurant_staff_invitations
  set status = 'revoked',
      updated_at = v_changed_at
  where restaurant_user_id = p_user_id
    and status <> 'revoked';

  update public.user_roles
  set status = 'inactive',
      updated_at = v_changed_at
  where user_id = p_user_id
    and role in ('restaurant_owner', 'restaurant_admin', 'restaurant_employee', 'restaurant_courier')
    and status <> 'inactive';

  update public.account_privacy_requests
  set status = 'completed',
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'completedAt', v_changed_at,
        'restaurantHidden', true,
        'authAccountPreserved', true,
        'reason', 'Historical orders, payments and any other active profile are retained'
      ),
      updated_at = v_changed_at
  where user_id = p_user_id
    and request_type = 'restaurant_deletion'
    and status in ('requested', 'in_review', 'approved');

  if not found then
    insert into public.account_privacy_requests (
      user_id, request_type, role_context, status, details, created_at, updated_at
    ) values (
      p_user_id, 'restaurant_deletion', 'restaurant_owner', 'completed',
      jsonb_build_object(
        'completedAt', v_changed_at,
        'restaurantHidden', true,
        'authAccountPreserved', true,
        'reason', 'Historical orders, payments and any other active profile are retained'
      ),
      v_changed_at, v_changed_at
    );
  end if;

  insert into public.platform_audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, restaurant_user_id,
    before_data, after_data, metadata, created_at
  ) values (
    p_user_id, 'restaurant_owner', 'restaurant_deleted', 'restaurant_profile', p_user_id, p_user_id,
    to_jsonb(v_profile),
    jsonb_build_object('active', false, 'operational_open', false, 'deleted_at', v_changed_at),
    jsonb_build_object('authAccountPreserved', true, 'historicalRecordsPreserved', true),
    v_changed_at
  );

  return query select p_user_id, true, true, v_changed_at;
end;
$$;

revoke all on function public.rc_ordera_finalize_restaurant_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.rc_ordera_finalize_restaurant_deletion(uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
