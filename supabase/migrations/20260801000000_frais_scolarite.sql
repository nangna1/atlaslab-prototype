-- Frais de scolarite / paiements : module de gestion financiere inclus pour
-- TOUS les etablissements (pas un palier payant). Contrairement aux autres
-- fonctionnalites staff existantes (offres_emploi, decrochage...), le
-- professeur est volontairement exclu de toute policy ici (ni ecriture, ni
-- lecture croisee sur les paiements des autres eleves) : les donnees
-- financieres sont plus sensibles, reservees a admin_tenant/super_admin.
--
-- frais_scolarite : definitions tenant-wide (avec filiere nullable, meme
-- convention que courses.filiere / offres_emploi.filiere -- null = s'applique
-- a tout le monde). paiements_frais : paiements individuels, en ajout seul
-- (append-only, pas de update/delete) pour permettre les paiements partiels
-- sans jamais corrompre l'historique. Le solde restant du n'est jamais
-- stocke : toujours recalcule en direct cote application comme
-- sum(frais dus) - sum(paiements), meme principe que progress/certificats
-- dans ce projet (jamais un etat cache qui pourrait diverger).

create table frais_scolarite (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  libelle text not null,
  filiere text,
  montant numeric(12,2) not null check (montant > 0),
  echeance date,
  cree_par uuid references users(id) not null,
  created_at timestamptz not null default now()
);
alter table frais_scolarite enable row level security;

create policy frais_select on frais_scolarite
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy frais_insert on frais_scolarite
  for insert with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

create policy frais_update on frais_scolarite
  for update
  using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

create policy frais_delete on frais_scolarite
  for delete using (
    coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

create table paiements_frais (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  frais_id uuid references frais_scolarite(id) not null,
  user_id uuid references users(id) not null,
  montant numeric(12,2) not null check (montant > 0),
  moyen_paiement text not null check (moyen_paiement in ('especes', 'virement', 'mobile_money', 'cheque', 'autre')),
  reference text,
  enregistre_par uuid references users(id) not null,
  created_at timestamptz not null default now()
);
alter table paiements_frais enable row level security;

create policy paiements_select on paiements_frais
  for select using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      user_id = auth.uid()
      or coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    )
  );

-- Pas de update/delete sur paiements_frais : un paiement enregistre est
-- definitif (voir docstring en tete de fichier) -- une correction reelle se
-- ferait pour l'instant directement en base par un super_admin, hors
-- perimetre applicatif pour ce pilote.
create policy paiements_insert on paiements_frais
  for insert with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
  );
