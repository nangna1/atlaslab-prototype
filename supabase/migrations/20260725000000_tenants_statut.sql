-- Auto-onboarding etablissement : un nouvel etablissement cree via l'inscription
-- publique demarre 'en_attente' et son premier admin est banni au niveau Supabase
-- Auth (voir signupTenant) jusqu'a approbation explicite d'un super_admin -- pas
-- seulement un gate cote UI, un vrai blocage de connexion.
alter table tenants
  add column statut text not null default 'actif' check (statut in ('actif', 'en_attente', 'refuse'));
