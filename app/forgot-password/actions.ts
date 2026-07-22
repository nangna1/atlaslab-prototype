"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export type ForgotPasswordState = { sent?: boolean; error?: "generic" };

// Meme convention que lib/cinetpay.ts / app/admin/**/actions.ts (URL fixe,
// pas de variable d'env dediee) -- implication assumee : ce flux ne peut
// plus etre teste en redirigeant vers localhost, seul un deploiement reel
// permet une verification complete.
const APP_BASE_URL = "https://atlaslabedu.com";

/**
 * Deplace cote serveur (etait un appel direct navigateur -> Supabase) pour
 * pouvoir limiter les tentatives : sans ca, n'importe qui peut spammer
 * l'email de reinitialisation vers n'importe quelle victime sans limite.
 * Si la limite est atteinte, renvoie le MEME etat que le succes reel
 * ({ sent: true }) -- coherent avec l'anti-enumeration deja en place ici
 * (ne jamais reveler d'info distinctive, ni sur l'existence d'un compte ni
 * sur le fait qu'une limite a ete atteinte).
 */
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "generic" };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const admin = createAdminClient();

  const okIp = await checkRateLimit(admin, `reset-password:ip:${ip}`, { max: 5, fenetreMinutes: 60 });
  const okEmail = await checkRateLimit(admin, `reset-password:email:${email.toLowerCase()}`, {
    max: 3,
    fenetreMinutes: 60,
  });

  if (okIp && okEmail) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_BASE_URL}/auth/callback?next=/reset-password`,
    });
    if (error && error.status && error.status >= 500) return { error: "generic" };
  }

  return { sent: true };
}
