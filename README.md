# AtlasLab — Prototype technique

Prototype de validation puis premier squelette du MVP AtlasLab (LMS + laboratoires virtuels
techniques pour l'enseignement technique et professionnel ivoirien). Voir la stratégie complète
dans le workspace `jarvis-starter-kit`, dossier `livrables/business/strategie/` :
- `2026-07-17_business-plan-marketing_edutech-ci.md`
- `2026-07-17_architecture-technique_atlaslab.md`
- `2026-07-17_messages-prospection_atlaslab.md`

## État actuel (17/07/2026)

**Fonctionne dès maintenant, sans rien configurer** (données simulées, pas de base réelle) :

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) — redirige vers `/cours`, qui affiche un
cours de démonstration ("Électronique — Bases des circuits", basé sur un premier module possible
pour l'Institut Booster Afrique) avec :
- une leçon de contenu texte,
- une leçon de laboratoire **électronique analogique** (`eecircuit-engine`, simulation SPICE réelle,
  circuit RC — cliquer "Lancer la simulation"),
- une leçon de laboratoire **logique numérique** (CircuitVerse intégré en iframe).

Les deux intégrations ont été testées et validées le 17/07/2026 (captures d'écran, résultats de
simulation réels) — voir `app/labo-test-eecircuit/` et `app/labo-test-circuitverse/` pour les
pages de test d'origine, et `components/LaboEEcircuit.tsx` / `components/LaboCircuitVerse.tsx`
pour les composants réutilisables qui en sont issus.

## Ce qui est réel vs simulé

| Élément | État |
|---|---|
| Pages `/cours`, `/cours/[id]`, `/cours/[id]/lecons/[id]` | Réelles, fonctionnelles |
| Simulation de circuits (eecircuit-engine, CircuitVerse) | Réelles, validées |
| Données (établissement, cours, modules, leçons) | **Simulées** (`lib/data/mock.ts`), pas de base de données |
| Authentification, multi-tenant réel, permissions | Pas encore implémentés |

## Brancher Supabase (prochaine étape technique)

Le schéma complet (tables + Row Level Security) est prêt dans
`supabase/migrations/20260717000000_init.sql`, et les clients Supabase sont déjà en place
(`lib/supabase/client.ts`, `lib/supabase/server.ts`). Il manque un projet Supabase réel pour
remplacer les données simulées par de vraies données multi-établissements :

1. Créer un compte gratuit sur [supabase.com](https://supabase.com) et un nouveau projet.
2. Dans l'onglet SQL Editor du projet, exécuter le contenu de
   `supabase/migrations/20260717000000_init.sql`.
3. Copier l'URL du projet et la clé `anon` (Project Settings → API) dans un fichier `.env.local` :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
   ```
4. Remplacer progressivement les appels à `lib/data/mock.ts` par de vraies requêtes via
   `lib/supabase/server.ts` dans les pages concernées.

Aucun de ces comptes ne peut être créé à la place de Mamadou (nécessite son email/son
authentification) — c'est la seule étape technique qui dépend de lui plutôt que de pouvoir être
faite en autonome.
