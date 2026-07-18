-- assignments/submissions ont RLS activee mais aucune policy depuis le
-- schema initial (meme defaut que progress/tenants/live_sessions avant
-- leurs correctifs) : totalement inaccessibles.
--
-- submissions n'avait pas de contrainte unique (assignment_id, user_id),
-- contrairement a progress/enrollments/attendance qui en ont toutes une —
-- necessaire pour un upsert propre (un eleve rend une fois, peut corriger
-- tant que pas note).
alter table submissions add constraint submissions_assignment_user_unique unique (assignment_id, user_id);

-- assignments : lecture via la lecon (herite de la RLS lessons -> modules
-- -> courses -> apprenant/enrollment, meme pattern que live_sessions ->
-- courses), ecriture staff seulement.
create policy assignments_select on assignments
  for select using (lesson_id in (select id from lessons));

create policy assignments_insert on assignments
  for insert with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and lesson_id in (select id from lessons)
  );

-- submissions : chacun voit/ecrit la sienne ; le staff voit/note toutes
-- celles de son tenant (via assignments, meme cascade). Le "verrou apres
-- notation" est un pur effet de bord RLS : with check (note is null) sur
-- la policy eleve empeche toute modification une fois note renseignee par
-- le staff (l'ancienne valeur de note persiste sur un UPDATE qui ne la
-- touche pas, donc le with check echoue des que note n'est plus null).
create policy submissions_select on submissions
  for select using (
    user_id = auth.uid()
    or (
      coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
      and assignment_id in (select id from assignments)
    )
  );

create policy submissions_insert on submissions
  for insert with check (
    user_id = auth.uid() and note is null and assignment_id in (select id from assignments)
  );

create policy submissions_update_self on submissions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and note is null);

create policy submissions_update_staff on submissions
  for update
  using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and assignment_id in (select id from assignments)
  )
  with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and assignment_id in (select id from assignments)
  );
