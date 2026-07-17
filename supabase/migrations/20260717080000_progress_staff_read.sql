-- progress_own_rows (20260717060000) laisse chacun gerer sa propre ligne,
-- mais un professeur ne peut donc lire QUE sa propre progression, jamais
-- celle de ses eleves. Ajoute une deuxieme policy SELECT permissive pour le
-- staff : Postgres combine les policies permissives du meme type par OR,
-- donc ceci ajoute un cas d'acces sans affaiblir la restriction existante.
create policy progress_staff_read on progress
  for select using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and user_id in (select id from users where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );
