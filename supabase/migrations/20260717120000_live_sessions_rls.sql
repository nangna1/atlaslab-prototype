-- live_sessions a RLS activee depuis le schema initial mais aucune policy
-- (comme progress/tenants avant leurs correctifs) : table totalement
-- inaccessible jusqu'ici. Meme schema que courses/modules/lessons
-- (20260717070000) : lecture via appartenance au cours (herite
-- automatiquement de la restriction apprenant/enrollment de courses_select
-- via la sous-requete), ecriture reservee au staff. Pas de policy update
-- dans cette iteration (creer/supprimer seulement).
create policy live_sessions_select on live_sessions
  for select using (
    course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy live_sessions_insert on live_sessions
  for insert with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy live_sessions_delete on live_sessions
  for delete using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );
