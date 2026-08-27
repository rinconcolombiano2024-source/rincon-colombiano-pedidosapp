-- RC ORDERA V89
-- Almacenamiento estable para logos y fotografias del menu.
-- Migracion idempotente y no destructiva: no elimina tablas ni datos.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'restaurant-media',
  'restaurant-media',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "RC Ordera restaurant media select own" on storage.objects;
create policy "RC Ordera restaurant media select own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'restaurant-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "RC Ordera restaurant media insert own" on storage.objects;
create policy "RC Ordera restaurant media insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'restaurant-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists "RC Ordera restaurant media update own" on storage.objects;
create policy "RC Ordera restaurant media update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'restaurant-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'restaurant-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists "RC Ordera restaurant media delete own" on storage.objects;
create policy "RC Ordera restaurant media delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'restaurant-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

notify pgrst, 'reload schema';

commit;

-- Validacion manual:
-- select id, public, file_size_limit, allowed_mime_types
-- from storage.buckets
-- where id = 'restaurant-media';
--
-- select policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'storage'
--   and tablename = 'objects'
--   and policyname like 'RC Ordera restaurant media%'
-- order by policyname;
