-- Emploi du temps : creneaux horaires hebdomadaires RECURRENTS par cours
-- (jour + heure debut/fin + salle optionnelle), distinct de live_sessions
-- qui reste ponctuel (une date precise + lien visio). Meme rattachement a
-- un cours, en recurrent plutot qu'en instantane.
--
-- RLS calquee sur modules_select/modules_insert (20260717070000) : la
-- restriction "un apprenant ne voit que ses cours inscrits" cascade
-- automatiquement via la RLS de courses elle-meme, pas besoin de la
-- repeter ici. Ecriture reservee a professeur/admin_tenant/super_admin,
-- meme liste que modules/lessons -- l'emploi du temps n'est pas une donnee
-- sensible (contrairement aux frais/portail parents).
create table creneaux_horaires (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  jour smallint not null check (jour between 0 and 6), -- 0 = lundi ... 6 = dimanche
  heure_debut time not null,
  heure_fin time not null,
  salle text,
  created_at timestamptz not null default now(),
  check (heure_fin > heure_debut)
);
alter table creneaux_horaires enable row level security;

create policy creneaux_select on creneaux_horaires
  for select using (
    course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy creneaux_insert on creneaux_horaires
  for insert with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy creneaux_update on creneaux_horaires
  for update
  using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  )
  with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy creneaux_delete on creneaux_horaires
  for delete using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );
