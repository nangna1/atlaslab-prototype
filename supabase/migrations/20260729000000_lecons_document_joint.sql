-- Piece jointe de lecon (PDF/Word/PPT deja prepares par le professeur) : pas
-- de tentative de parsing/structuration ici, juste un fichier consultable et
-- telechargeable attache a la lecon. Bucket public, meme pattern que "logos"
-- (20260718020000) -- le contenu pedagogique n'est pas plus sensible que le
-- logo, et un bucket prive aurait demande des URLs signees regenerees a
-- chaque affichage pour un gain de confidentialite marginal ici.
alter table lessons
  add column piece_jointe_url text,
  add column piece_jointe_nom text;

insert into storage.buckets (id, name, public) values ('lecons-documents', 'lecons-documents', true);

create policy "Documents de lecon publics en lecture" on storage.objects
  for select using (bucket_id = 'lecons-documents');

create policy "Staff peut deposer un document de lecon" on storage.objects
  for insert
  with check (
    bucket_id = 'lecons-documents'
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

create policy "Staff peut remplacer un document de lecon" on storage.objects
  for update using (
    bucket_id = 'lecons-documents'
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

create policy "Staff peut supprimer un document de lecon" on storage.objects
  for delete using (
    bucket_id = 'lecons-documents'
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );
