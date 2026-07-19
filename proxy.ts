import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 a renommé middleware.ts en proxy.ts (voir AGENTS.md) — même mécanisme,
// exécuté avant chaque route pour rafraîchir la session Supabase et rediriger
// les visiteurs non authentifiés vers /login.
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // /api/* exclu : ce sont des webhooks/routes serveur-a-serveur (ex. Meta
    // WhatsApp) sans session navigateur -- la redirection /login casserait
    // silencieusement tout appel entrant.
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|api/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
