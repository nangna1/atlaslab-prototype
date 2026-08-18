import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Historique (retire le 2026-08-18) : pdf-parse/pdfjs-dist necessitaient
  // ici serverExternalPackages + outputFileTracingIncludes pour tourner sur
  // le serverless Vercel, et meme avec ca ont fini par planter en prod
  // (pdfjs-dist depend de globals navigateur - DOMMatrix, Canvas - absents
  // de ce runtime ; erreur Sentry reelle : "ReferenceError: DOMMatrix is
  // not defined"). lib/document-text.ts:countPdfPages utilise desormais
  // pdf-lib (pure JS, sans dependance DOM/binaire natif) - plus besoin de
  // configuration Next.js particuliere pour le PDF.
  //
  // Limite par defaut des Server Actions Next.js : 1 Mo (voir
  // node_modules/next/dist/docs/.../server-actions.md) - beaucoup trop bas
  // pour generateCourseFromDocument (app/(app)/cours/actions.ts), qui recoit
  // de vrais supports de cours PDF. Releve a 20mb ici.
  //
  // Important (confirme le 2026-08-18, apres une vraie panne en prod) :
  // cette valeur n'est PAS la vraie limite effective sur Vercel. La
  // plateforme impose son propre plafond de corps de requete pour toute
  // fonction serverless, 4,5 Mo, **en dessous de ce 20mb** et qu'aucune
  // config Next.js ne peut relever (voir
  // https://vercel.com/docs/functions/limitations#request-body-size). La
  // vraie limite appliquee a l'utilisateur vit donc dans
  // lib/document-limits.ts (calculee a partir de 4,5 Mo, pas de ce 20mb) -
  // cette valeur-ci reste a 20mb seulement pour ne jamais etre elle-meme le
  // goulot d'etranglement.
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

// Pas de token d'authentification Sentry configure pour ce pilote (upload de
// source maps desactive, voir sourcemaps.disable) : evite de bloquer le
// build en son absence, quitte a avoir des stack traces minifiees dans
// Sentry pour l'instant.
export default withSentryConfig(nextConfig, {
  org: "atlaslab",
  project: "atlaslab-prototype",
  silent: !process.env.CI,
  sourcemaps: { disable: true },
});
