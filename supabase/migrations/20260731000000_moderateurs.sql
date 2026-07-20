-- Un professeur peut recevoir un statut de "moderateur" (accorde uniquement
-- par admin_tenant/super_admin) lui permettant de gerer les comptes
-- apprenant de son etablissement (activer/desactiver, modifier nom/telephone)
-- -- jamais les comptes professeur/admin. Reste toujours sous l'autorite des
-- admins : seul admin_tenant/super_admin peut activer ce statut.
alter table users add column est_moderateur boolean not null default false;

-- RLS est la vraie barriere (cf. commentaire dans
-- 20260717050000_users_write_restricted_to_admin.sql) -- la policy
-- update existante reste inchangee pour admin_tenant/super_admin ; on
-- ajoute une policy permissive supplementaire, restreinte aux lignes
-- apprenant du meme tenant, pour les professeurs moderateurs. Verifie en
-- direct via une sous-requete (pas via une claim JWT) pour que le retrait
-- du statut moderateur prenne effet immediatement, sans attendre un
-- rafraichissement de session.
create policy moderateur_update_apprenants on users
  for update
  using (
    role = 'apprenant'
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and exists (
      select 1 from users u
      where u.id = auth.uid() and u.role = 'professeur' and u.est_moderateur = true
    )
  )
  with check (
    role = 'apprenant'
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
