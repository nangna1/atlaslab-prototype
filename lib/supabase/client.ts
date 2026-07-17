import { createBrowserClient } from "@supabase/ssr";

// Nécessite un projet Supabase réel (voir README.md, section "Brancher Supabase").
// Tant que NEXT_PUBLIC_SUPABASE_URL n'est pas défini, les pages utilisent
// les données simulées de lib/data/mock.ts, pas ce client.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
