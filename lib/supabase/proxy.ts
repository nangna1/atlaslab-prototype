import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rafraîchit la session Supabase à chaque requête et protège les routes /cours.
// Appelé depuis proxy.ts (racine du projet — voir sa remarque sur le renommage
// middleware → proxy dans Next.js 16). Voir lib/supabase/client.ts et
// lib/supabase/server.ts pour les clients Browser/Server Components.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");
  const PUBLIC_ROUTES = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/verifier",
    "/inscription-etablissement",
  ];
  const isPublicRoute =
    request.nextUrl.pathname === "/" ||
    PUBLIC_ROUTES.some((route) => request.nextUrl.pathname.startsWith(route));

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Une session mot-de-passe (ou magic link, ex. "se connecter en tant que")
  // est deja valide en aal1 avant meme la verification 2FA -- sans ce controle
  // ici, la page /login ne serait qu'un gate cote client, contournable en
  // naviguant directement vers n'importe quelle route protegee.
  if (user && !isPublicRoute) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (user && isLoginRoute) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const stillNeedsMfa = aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel;
    if (!stillNeedsMfa) {
      const url = request.nextUrl.clone();
      url.pathname = "/cours";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
