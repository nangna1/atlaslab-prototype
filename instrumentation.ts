import * as Sentry from "@sentry/nextjs";

// Convention Next.js pour l'instrumentation serveur/edge (voir
// node_modules/next/dist/docs/01-app/02-guides/instrumentation.md) : ce
// fichier remplace l'ancien sentry.server.config.ts/sentry.edge.config.ts
// des versions plus anciennes du SDK.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      // 10% des requetes tracees : suffisant pour reperer des tendances de
      // performance sans saturer le quota gratuit sur un pilote a faible trafic.
      tracesSampleRate: 0.1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
