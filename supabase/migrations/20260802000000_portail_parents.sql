-- Portail parents : nouveau role 'parent', lecture seule, lie a un ou
-- plusieurs eleves via parents_enfants. Voit notes/bulletins (page bulletin
-- existante, reutilisee via un controle d'acces etendu cote application),
-- absences (attendance) et solde des frais de scolarite (paiements_frais,
-- deja lisible pour soi-meme -- etendu ici pour le parent lie).
--
-- Toutes les policies "parent_read_*" ci-dessous sont ADDITIVES : elles ne
-- remplacent aucune policy existante (Postgres additionne en OR plusieurs
-- policies permissives pour une meme commande), donc aucun changement de
-- comportement pour apprenant/professeur/admin_tenant/super_admin. Aucune
-- des policies parent n'autorise insert/update/delete : le role est
-- strictement lecture seule.

-- 1) Ajoute 'parent' au check constraint existant sur users.role. Nom de
-- contrainte retrouve dynamiquement (comme 20260728000000_notifications_nouvelle_offre.sql) :
-- son nom auto-genere par Postgres n'est pas garanti.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'users'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%apprenant%';

  if con_name is not null then
    execute format('alter table users drop constraint %I', con_name);
  end if;
end $$;

alter table users
  add constraint users_role_check
  check (role in ('super_admin', 'admin_tenant', 'professeur', 'apprenant', 'parent'));

-- 2) Lien parent <-> enfant. Un parent peut avoir plusieurs enfants, un
-- enfant plusieurs parents. Gestion (creation/suppression) reservee a
-- admin_tenant/super_admin, via une page admin dediee (app/admin/liens-parents/) --
-- separee de la creation de compte, pour pouvoir lier un enfant inscrit
-- plus tard ou ajouter un 2e parent sans recreer de compte.
create table parents_enfants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  parent_id uuid references users(id) not null,
  enfant_id uuid references users(id) not null,
  created_at timestamptz not null default now(),
  unique (parent_id, enfant_id)
);
alter table parents_enfants enable row level security;

create policy liens_select on parents_enfants
  for select using (
    parent_id = auth.uid()
    or (
      tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    )
  );

-- Verifie explicitement que parent_id a bien le role 'parent' ET enfant_id
-- le role 'apprenant', tous deux dans le tenant de l'appelant -- pas
-- seulement que la colonne tenant_id de la ligne correspond (meme classe de
-- faille que celle corrigee par 20260801020000_fix_paiements_frais_tenant_scope.sql,
-- ou frais_id n'etait jamais recoupe avec son propre tenant_id).
create policy liens_insert on parents_enfants
  for insert with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and parent_id in (select id from users where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid and role = 'parent')
    and enfant_id in (select id from users where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid and role = 'apprenant')
  );

create policy liens_delete on parents_enfants
  for delete using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- 3) Policies de lecture additives pour le parent, scoped via parents_enfants.
create policy parent_read_enrollments on enrollments
  for select using (
    coalesce(auth.jwt() ->> 'app_role', '') = 'parent'
    and user_id in (select enfant_id from parents_enfants where parent_id = auth.uid())
  );

create policy parent_read_courses on courses
  for select using (
    coalesce(auth.jwt() ->> 'app_role', '') = 'parent'
    and id in (
      select e.course_id from enrollments e
      join parents_enfants pe on pe.enfant_id = e.user_id
      where pe.parent_id = auth.uid()
    )
  );

create policy parent_read_modules on modules
  for select using (
    coalesce(auth.jwt() ->> 'app_role', '') = 'parent'
    and course_id in (
      select e.course_id from enrollments e
      join parents_enfants pe on pe.enfant_id = e.user_id
      where pe.parent_id = auth.uid()
    )
  );

create policy parent_read_lessons on lessons
  for select using (
    coalesce(auth.jwt() ->> 'app_role', '') = 'parent'
    and module_id in (
      select m.id from modules m
      join enrollments e on e.course_id = m.course_id
      join parents_enfants pe on pe.enfant_id = e.user_id
      where pe.parent_id = auth.uid()
    )
  );

create policy parent_read_progress on progress
  for select using (
    coalesce(auth.jwt() ->> 'app_role', '') = 'parent'
    and user_id in (select enfant_id from parents_enfants where parent_id = auth.uid())
  );

create policy parent_read_submissions on submissions
  for select using (
    coalesce(auth.jwt() ->> 'app_role', '') = 'parent'
    and user_id in (select enfant_id from parents_enfants where parent_id = auth.uid())
  );

create policy parent_read_attendance on attendance
  for select using (
    coalesce(auth.jwt() ->> 'app_role', '') = 'parent'
    and user_id in (select enfant_id from parents_enfants where parent_id = auth.uid())
  );

-- frais_scolarite : deja lisible tenant-wide sans condition de role
-- (frais_select), le parent en profite automatiquement via son propre
-- tenant_id. paiements_frais (staff-only ou soi-meme) a besoin d'une
-- policy dediee pour le parent :
create policy parent_read_paiements on paiements_frais
  for select using (
    coalesce(auth.jwt() ->> 'app_role', '') = 'parent'
    and user_id in (select enfant_id from parents_enfants where parent_id = auth.uid())
  );
