-- tenant_isolation_users_select (20260717050000) filtre par
-- "tenant_id = jwt tenant_id" — pour super_admin, les deux valent NULL, et
-- NULL = NULL n'est jamais vrai en SQL. Consequence concrete : un
-- super_admin ne peut pas lire sa PROPRE ligne public.users, donc toutes
-- les pages qui font "select role from users where id = auth.uid()" pour
-- verifier le role (app/admin/page.tsx, app/admin/etablissements/page.tsx,
-- etc.) le traitent comme non-authentifie et le renvoient vers /cours.
-- Meme correctif que tenants_select (20260717100000).
drop policy tenant_isolation_users_select on users;

create policy tenant_isolation_users_select on users
  for select using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    or coalesce(auth.jwt() ->> 'app_role', '') = 'super_admin'
  );
