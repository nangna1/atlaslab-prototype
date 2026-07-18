-- tenants n'avait qu'une policy select/insert (20260717100000) : un
-- admin_tenant ne pouvait pas modifier son propre etablissement (nom,
-- logo, couleur).
create policy tenants_update on tenants
  for update
  using (
    id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
  )
  with check (
    id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
  );

-- Bucket pour les logos d'etablissement (upload reel, pas juste un champ
-- URL). Chemin de stockage : logos/<tenant_id>/logo.<ext> — le prefixe de
-- dossier = tenant_id sert de frontiere RLS.
insert into storage.buckets (id, name, public) values ('logos', 'logos', true);

create policy "Logos publics en lecture" on storage.objects
  for select using (bucket_id = 'logos');

create policy "Admin peut uploader le logo de son tenant" on storage.objects
  for insert
  with check (
    bucket_id = 'logos'
    and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

create policy "Admin peut remplacer le logo de son tenant" on storage.objects
  for update
  using (
    bucket_id = 'logos'
    and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );
