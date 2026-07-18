-- Historique d'audit : qui a fait quoi et quand, pour les actions sensibles
-- (comptes, notes, personnalisation d'etablissement). Complement des
-- notifications ponctuelles existantes, mais persistant et consultable par
-- les admins d'etablissement plutot que pousse a un seul utilisateur.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  acteur_id uuid references users(id) not null,
  action text not null,
  cible_type text not null,
  cible_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

create index audit_log_tenant_created_idx on audit_log (tenant_id, created_at desc);

alter table audit_log enable row level security;

-- Lecture reservee aux admins (de l'etablissement, ou super_admin toutes
-- portees) -- un professeur n'a pas a voir les actions des autres.
create policy audit_log_select on audit_log
  for select using (
    coalesce(auth.jwt() ->> 'app_role', '') = 'super_admin'
    or (
      tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      and coalesce(auth.jwt() ->> 'app_role', '') = 'admin_tenant'
    )
  );

-- Ecriture : le staff peut journaliser ses propres actions, dans son tenant
-- (ou sans tenant pour un super_admin agissant au niveau plateforme).
create policy audit_log_insert on audit_log
  for insert with check (
    acteur_id = auth.uid()
    and coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and (
      tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      or (tenant_id is null and coalesce(auth.jwt() ->> 'app_role', '') = 'super_admin')
    )
  );
