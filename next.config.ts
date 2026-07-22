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
