-- Bourse aux stages/emplois : le staff publie des offres au nom d'entreprises
-- partenaires (pas de compte "recruteur" -- hors perimetre pour un pilote), les
-- eleves du meme etablissement les consultent. Prolonge le suivi d'insertion
-- professionnelle deja en place.
create table offres_emploi (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  titre text not null,
  entreprise text not null,
  type text not null check (type in ('stage', 'emploi')),
  filiere text,
  localisation text,
  description text,
  contact text,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'fermee')),
  publiee_par uuid references users(id) not null,
  created_at timestamptz not null default now()
);
alter table offres_emploi enable row level security;

create policy offres_select on offres_emploi
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy offres_insert on offres_emploi
  for insert with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

create policy offres_update on offres_emploi
  for update
  using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

create policy offres_delete on offres_emploi
  for delete using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
