import * as Sentry from "@sentry/nextjs";

// Convention Next.js >= 15.3 pour l'instrumentation cote client (voir
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md) :
// remplace l'ancien sentry.client.config.ts.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
