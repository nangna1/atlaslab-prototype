# AtlasLab — Prototype technique

LMS + laboratoires virtuels techniques pour l'enseignement technique et professionnel ivoirien,
multi-établissement (multi-tenant). Voir la stratégie complète dans le workspace
`jarvis-starter-kit`, dossier `livrables/business/strategie/` :
- `2026-07-17_business-plan-marketing_edutech-ci.md`
- `2026-07-17_architecture-technique_atlaslab.md`
- `2026-07-17_messages-prospection_atlaslab.md`

## Démarrage

Nécessite un projet Supabase réel (voir `.env.local`, non versionné — variables détaillées
plus bas) :

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) — redirige vers `/login`. Après connexion,
`/cours` affiche les cours réels du tenant de l'utilisateur connecté (isolation multi-établissement
via RLS + claims JWT).

## Fonctionnalités

**Cours & laboratoires**
- Cours / modules / leçons (texte, PDF/Word/PPT joint), import de cours via bibliothèque AtlasLab
  ou génération par IA à partir d'un document existant (`/cours/modele-import` : guide + modèle
  reproductible).
- Laboratoire électronique analogique réel (`eecircuit-engine`, simulation SPICE, résultats
  tension/temps) et laboratoire logique numérique (CircuitVerse intégré).
- Export de cours en PDF imprimable (support hors-ligne complet), mode hors-ligne (cache des leçons
  déjà visitées, labo EEcircuit offline), PWA installable.
- Devoirs (création, rendu, notation), y compris rendu par photo via WhatsApp. Quiz notés. Séances
  en direct (visio 8x8 JaaS avec modération automatique) + présence. Emploi du temps : créneaux
  hebdomadaires récurrents par cours, vue agrégée par rôle, avertissement de conflit horaire/salle.

**Comptes & rôles**
- Rôles apprenant / professeur / parent (portail lecture seule : notes, absences, frais de son
  enfant) / admin_tenant / super_admin. Progression, inscriptions, bulletin consolidé.
- Création de comptes (unitaire + import CSV en masse), recherche/filtre par nom, email ou rôle
  (`/admin`), désactivation, "Se connecter en tant que" (bascule rapide pour la démo/le support).
- Authentification à deux facteurs (TOTP) auto-service, changement de mot de passe et récupération
  (email, avec rate limiting anti email-bombing).
- Limites du plan d'essai (30 jours / 30 comptes apprenant+professeur), appliquées en RLS ; bascule
  vers un plan standard illimité par un super_admin (`/admin/etablissements`).

**Établissement & administration**
- Provisioning multi-établissement (super_admin) et auto-onboarding (demande publique via
  `/inscription-etablissement`, sous approbation), avec rate limiting (IP + email).
- Personnalisation par établissement (logo, couleur de marque, infos légales/modèle de certificat),
  export complet des données (archive ZIP de CSV), tableau de bord établissement (suivi
  journalier/hebdo, export CSV), historique d'audit (qui a fait quoi et quand).
- Frais de scolarité / paiements : suivi manuel par le staff, **et paiement en ligne réel** — chaque
  établissement associe son propre compte marchand CinetPay (identifiants chiffrés au repos,
  jamais un compte plateforme partagé) ; les élèves paient directement (Orange Money, MTN Money,
  Moov Money, Wave, carte).
- Certificats de fin de cours, vérification publique par QR code (signature HMAC, anti-fraude).
- Suivi d'insertion professionnelle des diplômés, bourse aux stages/emplois avec alerte par filière,
  alerte de décrochage (élèves inactifs), rapport d'impact exportable.

**Communication**
- Messagerie interne (professeur ↔ élève), notifications in-app + email, notifications WhatsApp
  (Meta Cloud API — alertes séance/devoir/message, réception de devoirs par photo via webhook).
- Fondation multilingue : français / anglais / arabe (RTL).

**Sécurité & fiabilité**
- RLS Postgres comme véritable barrière de sécurité (pas seulement un filtre applicatif),
  isolation multi-tenant testée de bout en bout.
- Rate limiting anti-abus (compté en base, pas de Redis) sur l'inscription établissement et le mot
  de passe oublié — voir `lib/rate-limit.ts`.
- Monitoring d'erreurs (Sentry, client + serveur), CI automatisée (typecheck + tests RLS à chaque
  push/PR sur `master`).

## Ce qui est réel vs simulé

| Élément | État |
|---|---|
| Cours, leçons, labos, comptes, RLS multi-tenant, paiement en ligne | Réels, testés de bout en bout |
| Simulation de circuits (eecircuit-engine, CircuitVerse) | Réelles, validées |
| WhatsApp, visio 8x8 JaaS, email (Resend), Sentry, CinetPay | Réels, nécessitent leurs propres identifiants (voir plus bas) |

## Tests

```bash
npm test
```

Tests d'intégration RLS/multi-tenant (Vitest) exécutés **contre le vrai projet Supabase de dev**
configuré dans `.env.local` (pas de stack Supabase locale/Docker dans cet environnement) — voir
`tests/setup.ts` et `tests/helpers/fixtures.ts`. `npx tsc --noEmit` pour le typecheck. CI
automatisée sur push/PR vers `master` (`.github/workflows/ci.yml`).

## Brancher Supabase

Schéma complet (tables + RLS) dans `supabase/migrations/`, appliquées à la main via le SQL Editor
du dashboard (pas de CLI Supabase en place), dans l'ordre chronologique du nom de fichier :
- `20260717000000_init.sql` — schéma + RLS de base
- `20260717010000_auth_hook.sql` — hook JWT custom (`tenant_id`, `app_role`) ; **doit aussi être
  activé manuellement** dans Dashboard → Authentication → Hooks → "Customize Access Token (JWT)
  Claims"
- `20260717020000_seed_demo.sql` — données de démo
- toutes les migrations suivantes, une par fonctionnalité, à appliquer dans l'ordre

Pour un nouveau projet Supabase : exécuter toutes les migrations dans l'ordre, puis créer un
utilisateur via Dashboard → Authentication → Users et l'insérer dans `public.users`.

## Variables d'environnement (`.env.local`, non versionné)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=                    # email (notifications, relances)
NEXT_PUBLIC_SENTRY_DSN=            # monitoring d'erreurs
ANTHROPIC_API_KEY=                 # génération de cours par IA
CERT_VERIFICATION_SECRET=          # HMAC des certificats (QR code)
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
WHATSAPP_APP_SECRET=               # verification signature webhook
WHATSAPP_VERIFY_TOKEN=
JAAS_APP_ID=
JAAS_KID=
JAAS_PRIVATE_KEY=
TENANT_SECRETS_ENCRYPTION_KEY=     # chiffrement des identifiants CinetPay par etablissement
```

Les identifiants CinetPay (paiement en ligne) ne sont PAS des variables d'environnement — chaque
établissement configure les siens depuis `/admin/etablissement`.
