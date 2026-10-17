-- RC ORDERA: read-only menu/settings persistence health.
-- Does not expose menu content, user IDs, image URLs or private settings.
-- Run with authorized database role. All queries are SELECT only.
SELECT
 count(*) AS restaurant_settings_rows,
 count(*) FILTER (WHERE menu IS NULL OR jsonb_typeof(menu) NOT IN ('array','object')) AS invalid_menu_shape,
 count(*) FILTER (WHERE settings IS NULL OR jsonb_typeof(settings) <> 'object') AS settings_not_object,
 count(*) FILTER (WHERE menu_revision IS NULL OR menu_revision < 0) AS invalid_menu_revision,
 count(*) FILTER (WHERE settings_revision IS NULL OR settings_revision < 0) AS invalid_settings_revision,
 count(*) FILTER (WHERE menu_updated_at IS NULL) AS missing_menu_updated_at,
 count(*) FILTER (WHERE settings_updated_at IS NULL) AS missing_settings_updated_at
FROM public.app_settings;

-- Current production stores menus as JSON objects; preserve that structure.\n-- Inspect the shape of menu data without extracting customer or product details.
SELECT jsonb_typeof(menu) AS menu_shape, count(*) AS restaurant_count
FROM public.app_settings
GROUP BY jsonb_typeof(menu)
ORDER BY restaurant_count DESC;

-- Backups indicate recoverability; counts alone do not prove restoration works.
SELECT
 (SELECT count(*) FROM public.menu_backups) AS legacy_backups,
 (SELECT count(*) FROM public.menu_recovery_backups) AS recovery_backups,
 (SELECT count(*) FROM public.restaurant_menu_backups) AS restaurant_backups;

-- Confirm persistence columns used by app, without assuming the client is synchronized.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'app_settings' AND column_name IN
      ('menu','settings','updated_at','menu_revision','settings_revision','menu_updated_at','settings_updated_at'))
    OR (table_name = 'restaurant_special_hours' AND column_name IN
      ('restaurant_user_id','service_date','closed','opens_at','closes_at','updated_at'))
  )
ORDER BY table_name,column_name;
