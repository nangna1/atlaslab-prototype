-- La policy tenant_isolation_users d'origine était "for all using (tenant_id
-- = jwt tenant_id)" : elle ne vérifiait QUE le tenant, pas le rôle. Résultat,
-- n'importe quel membre du tenant (y compris un apprenant) pouvait insérer
-- ou modifier n'importe quelle ligne public.users de son tenant via l'API
-- Supabase directe (anon key + son propre JWT), y compris s'auto-élever
-- admin_tenant/super_admin en changeant sa propre colonne "role". La page
-- /admin (app/admin/) n'est qu'une barrière applicative — la vraie barrière
-- doit être ici, en RLS.
--
-- Lecture : inchangée, tout membre du tenant peut voir les autres membres
-- (nécessaire pour /admin, /cours, etc.).
-- Écriture (insert/update/delete) : réservée à admin_tenant/super_admin.
drop policy tenant_isolation_users on users;

create policy tenant_isolation_users_select on users
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy tenant_isolation_users_insert on users
  for insert
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
  );

create policy tenant_isolation_users_update on users
  for update
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
  )
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
  );

create policy tenant_isolation_users_delete on users
  for delete using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
  );
