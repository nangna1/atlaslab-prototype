import type { SupabaseClient } from "@supabase/supabase-js";

type RateLimitOptions = { max: number; fenetreMinutes: number };

/**
 * Fenetre glissante comptee en Postgres (pas de Redis dans ce projet). Le
 * nettoyage des tentatives expirees pour CETTE cle se fait a chaque appel --
 * pas besoin de cron dedie, le volume par cle reste faible. Retourne false
 * (sans rien inserer) si la limite est deja atteinte.
 */
export async function checkRateLimit(
  admin: SupabaseClient,
  cle: string,
  { max, fenetreMinutes }: RateLimitOptions,
): Promise<boolean> {
  const depuis = new Date(Date.now() - fenetreMinutes * 60_000).toISOString();

  await admin.from("rate_limit_attempts").delete().eq("cle", cle).lt("created_at", depuis);

  const { count } = await admin
    .from("rate_limit_attempts")
    .select("id", { count: "exact", head: true })
    .eq("cle", cle)
    .gte("created_at", depuis);

  if ((count ?? 0) >= max) return false;

  await admin.from("rate_limit_attempts").insert({ cle });
  return true;
}
