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
  // de vrais supports de cours PDF. Verifie reellement sur un echantillon de
  // 30 documents fournis par l'utilisateur (2026-08-11, institut booster) :
  // jusqu'a 16,5 Mo. 20mb laisse de la marge. A revalider si Vercel impose
  // un plafond de plateforme plus bas que celui-ci pour les Server Actions
  // (non confirme au moment de ce changement).
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
