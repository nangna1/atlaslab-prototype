-- La table progress a RLS activée (20260717000000_init.sql) mais n'avait
-- encore aucune policy : par défaut Postgres refuse tout accès, la table
-- était donc totalement inutilisable. Un utilisateur ne gère que sa propre
-- progression (pas de policy tenant ici : user_id = auth.uid() suffit et
-- est plus strict qu'un simple filtre par tenant).
create policy progress_own_rows on progress
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
