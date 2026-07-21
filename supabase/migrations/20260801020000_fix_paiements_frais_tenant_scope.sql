-- Corrige une faille RLS reelle trouvee par les tests automatises
-- (tests/rls/frais-paiements.test.ts, "admin_tenant A ne peut pas enregistrer
-- de paiement contre un frais du tenant B") : paiements_insert ne verifiait
-- que paiements_frais.tenant_id = jwt tenant_id, jamais que frais_id
-- appartient reellement a CE tenant -- un admin_tenant pouvait donc
-- enregistrer un paiement rattache a un frais_scolarite d'un AUTRE tenant,
-- simplement en indiquant son propre tenant_id sur la ligne paiements_frais
-- elle-meme (frais_id n'etait jamais recoupe avec la table frais_scolarite).
drop policy paiements_insert on paiements_frais;

create policy paiements_insert on paiements_frais
  for insert with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    and frais_id in (select id from frais_scolarite where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );
