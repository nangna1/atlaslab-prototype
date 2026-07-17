-- tenants a RLS activee depuis le schema initial (20260717000000_init.sql)
-- mais n'a jamais eu de policy : table totalement inaccessible jusqu'ici
-- (d'ou le nom de tenant vide sur /cours, tenants(nom) ne remontait rien).
-- Necessaire maintenant pour le provisioning multi-etablissement : un
-- super_admin (tenant_id JWT null, cf. commentaire schema "sauf
-- super-admin AtlasLab") doit voir tous les tenants pour les gerer ; les
-- autres roles ne voient que le leur.
create policy tenants_select on tenants
  for select using (
    id = (auth.jwt() ->> 'tenant_id')::uuid
    or coalesce(auth.jwt() ->> 'app_role', '') = 'super_admin'
  );

create policy tenants_insert on tenants
  for insert with check (coalesce(auth.jwt() ->> 'app_role', '') = 'super_admin');
