import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // pdf-parse -> pdfjs-dist charge @napi-rs/canvas (binaire natif specifique
  // a la plateforme) de facon dynamique -- le bundler Next.js ne le detecte
  // pas correctement, ce qui casse l'extraction PDF en production (Vercel).
  // On force ces paquets en require() natif Node plutot qu'en bundle.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  // pdfjs-dist charge aussi son fichier "worker" (pdf.worker.mjs) par un
  // chemin calcule dynamiquement -- le tracing de fichiers de Vercel ne le
  // detecte pas et l'exclut du bundle serverless, faisant echouer
  // l'extraction PDF ("Setting up fake worker failed"). On force son
  // inclusion explicitement.
  outputFileTracingIncludes: {
    "/*": ["node_modules/pdfjs-dist/legacy/build/**/*"],
  },
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
