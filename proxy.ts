import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 a renommé middleware.ts en proxy.ts (voir AGENTS.md) — même mécanisme,
// exécuté avant chaque route pour rafraîchir la session Supabase et rediriger
// les visiteurs non authentifiés vers /login.
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
