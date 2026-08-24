-- RC ORDERA V86
-- Limites de servidor para documentos privados de colaboradores.

begin;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'courier-documents',
  'courier-documents',
  false,
  8388608,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Couriers upload own documents" on storage.objects;
create policy "Couriers upload own documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'courier-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('pdf', 'jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists "Couriers update own documents" on storage.objects;
create policy "Couriers update own documents"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'courier-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'courier-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('pdf', 'jpg', 'jpeg', 'png', 'webp')
);

notify pgrst, 'reload schema';

commit;
