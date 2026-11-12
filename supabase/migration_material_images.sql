-- Gestão de Demandas DelRio | imagens dos materiais
-- Bucket privado; leitura para usuários ativos e gravação restrita a quem gerencia o estoque.

begin;

alter table public.materials
  add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('material-images', 'material-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists material_images_authenticated_read on storage.objects;
create policy material_images_authenticated_read
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'material-images' and public.is_active_user());

drop policy if exists material_images_stock_insert on storage.objects;
create policy material_images_stock_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'material-images' and public.can_manage_stock());

drop policy if exists material_images_stock_update on storage.objects;
create policy material_images_stock_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'material-images' and public.can_manage_stock())
  with check (bucket_id = 'material-images' and public.can_manage_stock());

drop policy if exists material_images_stock_delete on storage.objects;
create policy material_images_stock_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'material-images' and public.can_manage_stock());

comment on column public.materials.image_path is
  'Caminho do arquivo no bucket privado material-images.';

commit;
