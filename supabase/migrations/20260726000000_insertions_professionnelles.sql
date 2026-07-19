-- Suivi d'insertion professionnelle des diplomes, par cours termine. Auto-declaration
-- par l'eleve (depuis sa page certificat) ou suivi/relance par le staff (page admin
-- dediee) -- meme etablissement uniquement, via les claims JWT existants.
create table insertions_professionnelles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  user_id uuid references users(id) not null,
  course_id uuid references courses(id) not null,
  statut text not null default 'en_recherche'
    check (statut in ('en_recherche', 'stage', 'emploi', 'entrepreneuriat', 'poursuite_etudes', 'sans_nouvelles')),
  entreprise text,
  poste text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);
alter table insertions_professionnelles enable row level security;

create policy insertions_select on insertions_professionnelles
  for select using (
    user_id = auth.uid()
    or tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

create policy insertions_insert on insertions_professionnelles
  for insert with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      user_id = auth.uid()
      or coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    )
  );

create policy insertions_update on insertions_professionnelles
  for update
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      user_id = auth.uid()
      or coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    )
  )
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      user_id = auth.uid()
      or coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    )
  );
