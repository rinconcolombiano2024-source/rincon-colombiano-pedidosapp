-- RC ORDERA v65
-- Seguridad incremental para lectura publica del menu.
-- No borra tablas ni datos. Solo limita app_settings publico a restaurantes activos.

drop policy if exists "Public read app menu settings" on public.app_settings;

create policy "Public read app menu settings"
on public.app_settings
for select
using (
  exists (
    select 1
    from public.restaurant_profiles rp
    where rp.user_id = app_settings.user_id
      and rp.active = true
  )
);

-- Verificacion opcional:
-- select business_name, active from public.restaurant_profiles order by updated_at desc;
