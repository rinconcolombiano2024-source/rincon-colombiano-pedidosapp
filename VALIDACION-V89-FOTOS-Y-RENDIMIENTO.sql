-- RC ORDERA V89: validacion de almacenamiento de imagenes.
-- Esta consulta solo lee metadatos y catalogos; no modifica datos.

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'restaurant-media';

select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'RC Ordera restaurant media%'
order by policyname;

-- Debe devolver cero despues de abrir el panel del restaurante y guardar el menu.
-- Indica cuantos productos publicos conservan fotos base64 pesadas en vez de URL.
with products as (
  select
    c.restaurant_user_id,
    product.value as product
  from public.restaurant_public_catalogs c
  cross join lateral jsonb_each(coalesce(c.menu, '{}'::jsonb)) category
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(category.value) = 'array' then category.value else '[]'::jsonb end
  ) product
)
select count(*)::bigint as inline_product_images_remaining
from products
where coalesce(product->>'imageUrl', product->>'image', product->>'photo', '') like 'data:image/%';

-- Confirma que los catalogos publicos tienen revision y fecha coherentes.
select
  count(*)::bigint as catalog_count,
  count(*) filter (where menu_revision >= 1)::bigint as catalogues_with_revision,
  count(*) filter (where menu_updated_at is not null)::bigint as catalogues_with_update_time
from public.restaurant_public_catalogs;
