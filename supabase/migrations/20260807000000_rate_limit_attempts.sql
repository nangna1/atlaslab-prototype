-- Rate limiting compte en base (pas de Redis dans ce projet -- Vercel
-- serverless + Supabase Postgres uniquement). Utilise par lib/rate-limit.ts
-- pour les points d'entree non authentifies exploitables : inscription
-- etablissement (app/inscription-etablissement/actions.ts) et mot de passe
-- oublie (app/forgot-password/actions.ts).
--
-- cle est une chaine libre composee par l'appelant (ex.
-- "signup-etablissement:ip:1.2.3.4", "reset-password:email:x@y.com") --
-- une meme IP/email peut etre limitee sur plusieurs axes independants.

create table rate_limit_attempts (
  id uuid primary key default gen_random_uuid(),
  cle text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_attempts_cle_created_idx on rate_limit_attempts (cle, created_at desc);
alter table rate_limit_attempts enable row level security;

-- AUCUNE policy : deny-all pour tout role authentifie -- seul le
-- service_role (via lib/rate-limit.ts) peut y toucher, meme idiome que
-- tenant_paiement_config (20260806000000_tenant_paiement_config.sql).
