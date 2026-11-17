-- =====================================================================
-- TPAC — Storage buckets and policies
--  product-images : public read, staff write (catalog photography)
--  site-media     : public read, staff write (banners, campaign imagery)
--  design-uploads : PRIVATE. Customer artwork + design previews. Written
--                   only by the server (service role) after type/size
--                   validation; read by staff through signed URLs.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('site-media', 'site-media', true, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('design-uploads', 'design-uploads', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public read catalog media" on storage.objects for select to anon, authenticated
  using (bucket_id in ('product-images', 'site-media'));

create policy "staff write catalog media" on storage.objects for insert to authenticated
  with check (bucket_id in ('product-images', 'site-media') and public.is_staff());
create policy "staff update catalog media" on storage.objects for update to authenticated
  using (bucket_id in ('product-images', 'site-media') and public.is_staff());
create policy "staff delete catalog media" on storage.objects for delete to authenticated
  using (bucket_id in ('product-images', 'site-media') and public.is_staff());

create policy "staff read design uploads" on storage.objects for select to authenticated
  using (bucket_id = 'design-uploads' and public.is_staff());
