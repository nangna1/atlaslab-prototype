-- Restreint la visibilité des cours pour le rôle "apprenant" aux cours où il
-- a une inscription (table enrollments). Les autres rôles (professeur,
-- admin_tenant, super_admin) gardent le comportement actuel : tout le tenant.
--
-- modules/lessons n'ont pas besoin d'être touchées : leurs policies filtrent
-- déjà via "course_id in (select id from courses where ...)", et cette
-- sous-requête est elle-même soumise à la RLS de courses — la restriction
-- cascade automatiquement.
drop policy tenant_isolation_courses on courses;

create policy tenant_isolation_courses on courses
  for all using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      coalesce(auth.jwt() ->> 'app_role', '') <> 'apprenant'
      or id in (select course_id from enrollments where user_id = auth.uid())
    )
  );
