import { createClient } from "@supabase/supabase-js";

// Client Supabase privilégié (clé service_role). À utiliser UNIQUEMENT dans
// du code serveur (Server Actions / Route Handlers) — jamais importé depuis
// un composant client, la clé service_role contourne toute RLS.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
