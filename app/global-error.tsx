"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import NextError from "next/error";

// Filet de secours au-dessus du layout racine (erreurs que error.tsx ne peut
// pas attraper, ex: erreur dans layout.tsx lui-meme) -- remonte a Sentry,
// recommandation officielle du SDK.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
