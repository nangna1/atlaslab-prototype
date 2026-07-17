-- Meme defaut que public.users (corrige dans 20260717050000) : les policies
-- "for all using (tenant_id = ...)" sur enrollments/courses/modules/lessons
-- ne verifient que le tenant, jamais le role. Consequence concrete verifiee :
-- un apprenant peut s'auto-inscrire a n'importe quel cours de son tenant en
-- appelant l'API Supabase directement (insert dans enrollments), ce qui
-- contourne entierement la restriction RLS "vue apprenant" de
-- 20260717040000 — puisque cette restriction se base justement sur
-- enrollments. Meme probleme sur courses/modules/lessons : un apprenant
-- inscrit (ou n'importe quel autre role) pouvait modifier/supprimer le
-- contenu pedagogique via l'API directe.
--
-- Lecture : comportement inchange partout. Ecriture (insert/update/delete) :
-- desormais reservee a professeur/admin_tenant/super_admin.

-- enrollments
drop policy tenant_isolation_enrollments on enrollments;

create policy enrollments_select on enrollments
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy enrollments_insert on enrollments
  for insert
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
  );

create policy enrollments_update on enrollments
  for update
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
  )
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
  );

create policy enrollments_delete on enrollments
  for delete using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
  );

-- courses (garde la restriction apprenant/enrollment existante en lecture)
drop policy tenant_isolation_courses on courses;

create policy courses_select on courses
  for select using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      coalesce(auth.jwt() ->> 'app_role', '') <> 'apprenant'
      or id in (select course_id from enrollments where user_id = auth.uid())
    )
  );

create policy courses_insert on courses
  for insert
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
  );

create policy courses_update on courses
  for update
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
  )
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
  );

create policy courses_delete on courses
  for delete using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
  );

-- modules
drop policy tenant_isolation_modules on modules;

create policy modules_select on modules
  for select using (
    course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy modules_insert on modules
  for insert
  with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy modules_update on modules
  for update
  using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  )
  with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy modules_delete on modules
  for delete using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

-- lessons
drop policy tenant_isolation_lessons on lessons;

create policy lessons_select on lessons
  for select using (
    module_id in (
      select m.id from modules m
      join courses c on c.id = m.course_id
      where c.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

create policy lessons_insert on lessons
  for insert
  with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and module_id in (
      select m.id from modules m
      join courses c on c.id = m.course_id
      where c.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

create policy lessons_update on lessons
  for update
  using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and module_id in (
      select m.id from modules m
      join courses c on c.id = m.course_id
      where c.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  )
  with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and module_id in (
      select m.id from modules m
      join courses c on c.id = m.course_id
      where c.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

create policy lessons_delete on lessons
  for delete using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and module_id in (
      select m.id from modules m
      join courses c on c.id = m.course_id
      where c.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );
