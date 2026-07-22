-- Identifiants marchand CinetPay par etablissement (pas de compte plateforme
-- unique -- chaque tenant encaisse directement sur son propre compte
-- marchand, AtlasLab ne s'interpose jamais dans la transaction). Voir
-- lib/tenant-cinetpay.ts, app/admin/etablissement/PaiementGatewayForm.tsx.
--
-- api_key/secret_key chiffres au repos (AES-256-GCM, voir lib/crypto-secrets.ts) --
-- site_id n'est qu'un identifiant, pas un secret, laisse en clair pour
-- faciliter le support/debug.

create table tenant_paiement_config (
  tenant_id uuid primary key references tenants(id),
  gateway text not null default 'cinetpay' check (gateway in ('cinetpay')),
  site_id text not null,
  api_key_chiffre text not null,
  secret_key_chiffre text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table tenant_paiement_config enable row level security;

-- AUCUNE policy : RLS active + zero policy = deny-all pour tout role, y
-- compris admin_tenant/super_admin -- seul le client service_role (qui
-- contourne RLS) peut lire/ecrire, exclusivement depuis
-- lib/tenant-cinetpay.ts. Ces identifiants marchand ne doivent jamais
-- transiter par une requete PostgREST authentifiee ordinaire, meme pour en
-- verifier juste l'existence (voir hasTenantCinetPayConfig, qui passe aussi
-- par le client service-role).
