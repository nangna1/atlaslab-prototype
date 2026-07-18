-- attendance existe depuis le debut (RLS activee) mais sans aucune policy -> table
-- totalement inaccessible. Meme pattern cascade que assignments/submissions : lecture via
-- live_sessions (qui herite deja de l'isolation tenant via courses), ecriture staff seulement.

create policy attendance_select on attendance
  for select using (
    user_id = auth.uid()
    or (
      coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
      and live_session_id in (select id from live_sessions)
    )
  );

create policy attendance_insert on attendance
  for insert with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and live_session_id in (select id from live_sessions)
  );

create policy attendance_update on attendance
  for update
  using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and live_session_id in (select id from live_sessions)
  )
  with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and live_session_id in (select id from live_sessions)
  );
