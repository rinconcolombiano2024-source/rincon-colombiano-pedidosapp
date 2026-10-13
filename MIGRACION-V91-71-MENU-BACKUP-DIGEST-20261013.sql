-- RC ORDERA 2026-10-13: fix menu backup digest resolution without altering menu/permissions.
-- pgcrypto lives in extensions, while these SECURITY DEFINER routines limit search_path.
-- Preservation: identical business guards, backup logic, ACL and function signatures.
CREATE OR REPLACE FUNCTION public.clear_current_restaurant_menu(p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_row public.app_settings%rowtype;
  v_backup_id uuid;
  v_hash text;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.rc_ordera_current_user_can_own_restaurant() then raise exception 'Restaurant owner role required'; end if;
  if coalesce(p_confirmation, '') <> 'VACIAR MENU' then raise exception 'Invalid confirmation phrase'; end if;

  select s.* into v_row from public.app_settings s where s.user_id = v_user_id for update;
  if not found then raise exception 'Restaurant menu was not found'; end if;
  v_count := public.rc_ordera_menu_product_count(v_row.menu);
  v_hash := encode(extensions.digest(convert_to(v_row.menu::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.restaurant_menu_backups (
    restaurant_user_id, menu, settings_snapshot, menu_revision,
    product_count, content_hash, reason, created_by_user_id
  ) values (
    v_user_id, v_row.menu, coalesce(v_row.settings, '{}'::jsonb),
    v_row.menu_revision, v_count, v_hash, 'explicit_secure_clear', v_user_id
  ) on conflict (restaurant_user_id, menu_revision, content_hash)
  do update set reason = 'explicit_secure_clear'
  returning id into v_backup_id;

  perform set_config('rc_ordera.allow_menu_clear', 'on', true);
  perform set_config('rc_ordera.menu_backup_reason', 'explicit_secure_clear', true);
  update public.app_settings s set menu = '{}'::jsonb where s.user_id = v_user_id returning * into v_row;

  insert into public.platform_audit_logs (
    actor_user_id, actor_role, action, entity_type, restaurant_user_id,
    before_data, after_data, metadata
  ) values (
    v_user_id, 'restaurant_owner', 'secure_menu_clear', 'app_settings', v_user_id,
    jsonb_build_object('menuRevision', v_row.menu_revision - 1, 'productCount', v_count, 'backupId', v_backup_id),
    jsonb_build_object('menuRevision', v_row.menu_revision, 'productCount', 0),
    jsonb_build_object('confirmation', 'VACIAR MENU')
  );

  return jsonb_build_object(
    'backupId', v_backup_id,
    'menu', v_row.menu,
    'menuRevision', v_row.menu_revision,
    'productCount', 0
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.rc_ordera_protect_app_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_old_count integer := public.rc_ordera_menu_product_count(old.menu);
  v_new_count integer := public.rc_ordera_menu_product_count(new.menu);
  v_clear_allowed boolean := coalesce(current_setting('rc_ordera.allow_menu_clear', true), '') = 'on';
  v_reason text := coalesce(nullif(current_setting('rc_ordera.menu_backup_reason', true), ''), 'menu_update');
  v_hash text;
begin
  if new.menu is distinct from old.menu then
    if v_old_count > 0 and v_new_count = 0 and not v_clear_allowed then
      raise exception 'MENU_EMPTY_REQUIRES_SECURE_CLEAR';
    end if;

    if v_old_count > 0 then
      v_hash := encode(extensions.digest(convert_to(old.menu::text, 'UTF8'), 'sha256'), 'hex');
      insert into public.restaurant_menu_backups (
        restaurant_user_id, menu, settings_snapshot, menu_revision,
        product_count, content_hash, reason, created_by_user_id
      ) values (
        old.user_id, old.menu, coalesce(old.settings, '{}'::jsonb),
        greatest(coalesce(old.menu_revision, 1), 1), v_old_count,
        v_hash, left(v_reason, 80), auth.uid()
      ) on conflict (restaurant_user_id, menu_revision, content_hash) do nothing;
    end if;

    new.menu_revision := greatest(coalesce(old.menu_revision, 1), 1) + 1;
    new.menu_updated_at := now();
  else
    new.menu_revision := old.menu_revision;
    new.menu_updated_at := old.menu_updated_at;
  end if;

  if new.settings is distinct from old.settings then
    new.settings_revision := greatest(coalesce(old.settings_revision, 1), 1) + 1;
    new.settings_updated_at := now();
  else
    new.settings_revision := old.settings_revision;
    new.settings_updated_at := old.settings_updated_at;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;
