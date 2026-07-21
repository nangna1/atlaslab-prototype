import { config } from "dotenv";
import path from "path";

// vitest ne charge pas .env.local automatiquement comme le fait Next.js :
// on le fait nous-memes, une seule fois avant toute suite.
config({ path: path.resolve(__dirname, "..", ".env.local") });

for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  if (!process.env[name]) {
    throw new Error(
      `${name} manquant : les tests RLS s'executent contre le projet Supabase ` +
        `de dev reel (voir .env.local, non versionne) et ne peuvent pas tourner sans lui.`,
    );
  }
}
