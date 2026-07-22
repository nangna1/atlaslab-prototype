-- Paiement en ligne (CinetPay, mode sandbox d'abord) des frais de scolarite.
-- Contrairement a paiements_frais (ecriture staff uniquement, voir
-- 20260801000000_frais_scolarite.sql), un paiement en ligne est initie par
-- l'eleve/parent lui-meme -- d'ou une table intermediaire dediee : le
-- transaction_id doit exister AVANT que CinetPay ne confirme quoi que ce
-- soit (redirection navigateur), et le webhook (appel serveur-a-serveur,
-- sans session utilisateur) doit pouvoir retrouver frais_id/user_id/montant
-- a partir de ce seul transaction_id, de facon idempotente (CinetPay peut
-- livrer le meme webhook plusieurs fois).
--
-- Regle de confiance : ni cette table ni le webhook ne font jamais confiance
-- au contenu du payload webhook pour crediter de l'argent -- seule la reponse
-- de l'appel serveur-a-serveur /v2/payment/check (avec notre propre cle
-- secrete) fait foi. Voir app/api/paiements/webhook/route.ts et lib/cinetpay.ts.

create table paiements_frais_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  frais_id uuid references frais_scolarite(id) not null,
  user_id uuid references users(id) not null,
  montant numeric(12,2) not null check (montant > 0),
  gateway text not null default 'cinetpay' check (gateway in ('cinetpay')),
  transaction_id text not null unique,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'reussi', 'echoue', 'annule')),
  canal_paiement text,
  paiement_id uuid references paiements_frais(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table paiements_frais_transactions enable row level security;

-- Lecture : le payeur voit ses propres transactions, le staff finances
-- (admin_tenant/super_admin, meme restriction que paiements_frais --
-- professeur exclu) voit tout le tenant.
create policy paiements_transactions_select on paiements_frais_transactions
  for select using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      user_id = auth.uid()
      or coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    )
  );

-- Creation : n'importe quel utilisateur authentifie peut initier un paiement,
-- mais UNIQUEMENT pour lui-meme et pour un frais de SON tenant (meme
-- recoupement que le correctif 20260801020000 sur paiements_insert).
create policy paiements_transactions_insert on paiements_frais_transactions
  for insert with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and user_id = auth.uid()
    and statut = 'en_attente'
    and frais_id in (select id from frais_scolarite where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

-- Mise a jour : le proprietaire peut UNIQUEMENT annuler/marquer en echec sa
-- propre transaction encore en attente (ex. l'initiation CinetPay a echoue
-- juste apres la creation de la ligne, ou abandon volontaire) -- jamais la
-- faire passer a 'reussi' lui-meme. Toute transition vers 'reussi' est
-- reservee au webhook, qui utilise le client service-role (contourne RLS).
create policy paiements_transactions_update_self_cancel on paiements_frais_transactions
  for update
  using (user_id = auth.uid() and statut = 'en_attente')
  with check (user_id = auth.uid() and statut in ('echoue', 'annule'));

-- Pas de policy delete : historique conserve, comme paiements_frais.

-- ---------------------------------------------------------------------------
-- paiements_frais : deux changements additifs, flux manuel inchange.

-- 1) enregistre_par nullable : un paiement confirme par le webhook CinetPay
-- n'a pas d'acteur staff. NULL represente "aucun acteur humain" -- aucun
-- ecran existant (app/admin/paiements/[userId]/page.tsx, app/mes-frais/page.tsx)
-- n'affiche enregistre_par, donc aucune UI ne casse.
alter table paiements_frais alter column enregistre_par drop not null;

-- 2) moyen_paiement : ajoute les canaux reels rapportes par CinetPay (plutot
-- qu'une seule valeur generique) car EnregistrerPaiementForm.tsx /
-- [userId]/page.tsx / mes-frais/page.tsx affichent la chaine brute a l'ecran --
-- le staff doit pouvoir distinguer Wave d'Orange Money en cas de litige.
-- "paiement_en_ligne" reste un filet de securite pour un canal CinetPay non
-- reconnu par lib/cinetpay.ts::mapCinetPayChannelToMoyenPaiement (ne doit
-- jamais bloquer un paiement reel via une contrainte CHECK trop stricte).
alter table paiements_frais drop constraint paiements_frais_moyen_paiement_check;
alter table paiements_frais
  add constraint paiements_frais_moyen_paiement_check
  check (moyen_paiement in (
    'especes', 'virement', 'mobile_money', 'cheque', 'autre',
    'orange_money_ci', 'mtn_money_ci', 'moov_money', 'wave_ci', 'carte_bancaire',
    'paiement_en_ligne'
  ));

-- ---------------------------------------------------------------------------
-- Confirmation atomique : une seule fonction fait a la fois (a) la
-- transition en_attente -> reussi (guardee par la clause WHERE, donc
-- idempotente meme sous livraison webhook concurrente/dupliquee -- un seul
-- appel peut matcher statut = 'en_attente') et (b) l'insertion dans
-- paiements_frais, dans UNE transaction Postgres reelle -- pas deux appels
-- separes qui pourraient echouer entre les deux.
create or replace function confirmer_paiement_en_ligne(
  p_transaction_id text,
  p_moyen_paiement text
) returns uuid
language plpgsql
as $$
declare
  v_txn paiements_frais_transactions%rowtype;
  v_paiement_id uuid;
begin
  update paiements_frais_transactions
    set statut = 'reussi', canal_paiement = p_moyen_paiement, updated_at = now()
    where transaction_id = p_transaction_id and statut = 'en_attente'
    returning * into v_txn;

  if not found then
    return null; -- transaction inconnue, deja traitee, ou deja marquee echouee/annulee
  end if;

  insert into paiements_frais (tenant_id, frais_id, user_id, montant, moyen_paiement, reference, enregistre_par)
  values (v_txn.tenant_id, v_txn.frais_id, v_txn.user_id, v_txn.montant, p_moyen_paiement, p_transaction_id, null)
  returning id into v_paiement_id;

  update paiements_frais_transactions set paiement_id = v_paiement_id where id = v_txn.id;

  return v_paiement_id;
end;
$$;

-- Reservee au webhook (client service-role) : ni anon ni authenticated ne
-- doivent pouvoir l'invoquer directement, en defense en profondeur (meme
-- idiome que le grant/revoke de custom_access_token_hook dans
-- 20260717010000_auth_hook.sql).
revoke execute on function confirmer_paiement_en_ligne from authenticated, anon, public;
grant execute on function confirmer_paiement_en_ligne to service_role;
