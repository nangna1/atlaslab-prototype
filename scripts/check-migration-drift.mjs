// Garde-fou contre la derive entre supabase/migrations/ et l'etat reel de la
// base (les migrations sont appliquees a la main via le SQL Editor du
// dashboard Supabase, cf. README.md "Brancher Supabase" - aucun outil ne
// garantit aujourd'hui qu'une migration du repo a bien ete executee en
// prod/dev). Ce script se connecte au VRAI projet Supabase (memes
// identifiants que tests/helpers/fixtures.ts, service role key - bypasse
// RLS) et verifie, pour chaque migration qui cree une table/colonne, que
// cette table/colonne existe reellement.
//
// Limite assumee et documentee, pas cachee : seules les migrations qui
// creent une table ou ajoutent une colonne ont une "signature" verifiable
// simplement via l'API REST (PostgREST) sans infrastructure supplementaire.
// Les migrations RLS-only/fonctions/grants/donnees (~24 des 40 migrations
// actuelles) ne sont PAS couvertes par ce script - une verification
// generique (ex: interroger pg_policies) demanderait une fonction RPC
// dediee, hors scope de ce garde-fou minimal. Mais les migrations avec
// signature couvrent la plupart des ajouts recents/a fort enjeu metier
// (paiements, rate limiting, config tenant) - le cas de derive le plus
// probable et le plus couteux (une table jamais creee) reste detecte.
//
// Usage : npm run check-migrations
//
// Charge .env.local via dotenv comme tests/setup.ts (pas le flag natif
// --env-file de Node) : meme comportement tolerant en CI, ou .env.local
// n'existe pas mais les variables sont deja injectees par GitHub Actions.

import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

// [fichier de migration, table a verifier, colonne a verifier (null = juste
// l'existence de la table)] - extrait des "create table"/"alter table ...
// add column" de chaque fichier (voir supabase/migrations/).
//
// A MAINTENIR : chaque nouvelle migration qui cree une table ou ajoute une
// colonne devrait ajouter une ligne ici (sinon elle reste silencieusement
// non couverte, pas signalee en erreur - mais autant la couvrir).
const SIGNATURES = [
  ["20260717000000_init.sql", "tenants", null],
  ["20260718000000_quiz_questions.sql", "lessons", "quiz_questions"],
  ["20260718010000_users_actif.sql", "users", "actif"],
  ["20260722000000_notifications.sql", "notifications", null],
  ["20260723000000_audit_log.sql", "audit_log", null],
  ["20260724000000_messages.sql", "messages", null],
  ["20260726000000_insertions_professionnelles.sql", "insertions_professionnelles", null],
  ["20260727000000_offres_emploi.sql", "offres_emploi", null],
  ["20260730000000_whatsapp_devoirs.sql", "whatsapp_devoir_attente", null],
  ["20260731000000_moderateurs.sql", "users", "est_moderateur"],
  ["20260801000000_frais_scolarite.sql", "frais_scolarite", null],
  ["20260802000000_portail_parents.sql", "parents_enfants", null],
  ["20260803000000_emploi_du_temps.sql", "creneaux_horaires", null],
  ["20260805000000_paiement_en_ligne_cinetpay.sql", "paiements_frais_transactions", null],
  ["20260806000000_tenant_paiement_config.sql", "tenant_paiement_config", null],
  ["20260807000000_rate_limit_attempts.sql", "rate_limit_attempts", null],
  ["20260811000000_piece_jointe_telechargement.sql", "lessons", "piece_jointe_telechargeable"],
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (voir .env.local).");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let missing = 0;
for (const [migration, table, column] of SIGNATURES) {
  const { error } = await admin.from(table).select(column ?? "*").limit(0);
  if (error) {
    missing++;
    console.log(`✗ MANQUANTE  ${migration}  (${table}${column ? "." + column : ""} : ${error.message})`);
  } else {
    console.log(`✓ OK         ${migration}`);
  }
}

console.log();
console.log(`${SIGNATURES.length - missing}/${SIGNATURES.length} migrations avec signature verifiees presentes.`);
console.log(
  `Non couvert par ce script : les migrations RLS-only/fonctions/grants/donnees ` +
    `(pas de table/colonne a verifier) - a inspecter manuellement si un doute existe.`,
);

process.exit(missing > 0 ? 1 : 0);
