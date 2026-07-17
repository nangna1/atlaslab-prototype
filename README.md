# AtlasLab — Prototype technique

Prototype de validation puis premier squelette du MVP AtlasLab (LMS + laboratoires virtuels
techniques pour l'enseignement technique et professionnel ivoirien). Voir la stratégie complète
dans le workspace `jarvis-starter-kit`, dossier `livrables/business/strategie/` :
- `2026-07-17_business-plan-marketing_edutech-ci.md`
- `2026-07-17_architecture-technique_atlaslab.md`
- `2026-07-17_messages-prospection_atlaslab.md`

## État actuel (17/07/2026)

**Nécessite un projet Supabase réel** (voir `.env.local`, non versionné) :

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) — redirige vers `/login`. Après connexion,
`/cours` affiche les cours réels du tenant de l'utilisateur connecté (isolation multi-établissement
via RLS + claims JWT), par exemple "Électronique — Bases des circuits" (Institut Booster Afrique)
avec :
- une leçon de contenu texte,
- une leçon de laboratoire **électronique analogique** (`eecircuit-engine`, simulation SPICE réelle,
  circuit RC — cliquer "Lancer la simulation"),
- une leçon de laboratoire **logique numérique** (CircuitVerse intégré en iframe).

Les deux intégrations labo ont été testées et validées le 17/07/2026 (captures d'écran, résultats
de simulation réels) — voir `app/labo-test-eecircuit/` et `app/labo-test-circuitverse/` pour les
pages de test d'origine, et `components/LaboEEcircuit.tsx` / `components/LaboCircuitVerse.tsx`
pour les composants réutilisables qui en sont issus.

## Ce qui est réel vs simulé

| Élément | État |
|---|---|
| Pages `/cours`, `/cours/[id]`, `/cours/[id]/lecons/[id]` | Réelles, fonctionnelles |
| Simulation de circuits (eecircuit-engine, CircuitVerse) | Réelles, validées |
| Authentification, multi-tenant, RLS | Réelles, testées de bout en bout |
| Données (établissement, cours, modules, leçons) | Réelles (Supabase), seedées via `supabase/migrations/` |
| Rôles apprenant / admin_tenant / super_admin, progression, inscriptions | Schéma en place, pas encore d'UI |

## Brancher Supabase (déjà fait pour l'environnement de dev actuel)

Le schéma complet (tables + Row Level Security) et les migrations d'auth sont dans
`supabase/migrations/` (appliquées à la main via le SQL Editor du dashboard, pas de CLI Supabase
en place) :
- `20260717000000_init.sql` — schéma + RLS
- `20260717010000_auth_hook.sql` — hook JWT custom (`tenant_id`, `app_role`) ; **doit aussi être
  activé manuellement** dans Dashboard → Authentication → Hooks → "Customize Access Token (JWT)
  Claims"
- `20260717020000_seed_demo.sql` — données de démo (Institut Booster Afrique)
- `20260717030000_fix_auth_hook_grant.sql` — grant nécessaire pour que le hook puisse lire
  `public.users`

Pour un nouveau projet Supabase, exécuter ces migrations dans l'ordre, puis créer un utilisateur
via Dashboard → Authentication → Users et l'insérer dans `public.users` (voir le commentaire en
tête de `20260717020000_seed_demo.sql`).

Variables d'environnement (`.env.local`, non versionné) :
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
```
