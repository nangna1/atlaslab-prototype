import type { SupabaseClient } from "@supabase/supabase-js";

// Plan 'essai' : limite de duree ET de nombre de comptes (voir
// supabase/migrations/20260804000000_tenant_essai_limites.sql pour la vraie
// barriere RLS -- ce pre-check applicatif sert uniquement a donner un
// message clair AVANT de creer le compte auth, pour ne jamais laisser un
// compte auth.users orphelin si l'insertion public.users est ensuite
// bloquee par la RLS.
export const DUREE_ESSAI_JOURS = 30;
export const LIMITE_COMPTES_ESSAI = 30;

export type LimiteEssaiInfo = {
  enEssai: boolean;
  joursEcoules: number;
  joursRestants: number;
  nbComptes: number;
  limiteAtteinte: boolean;
};

async function chargerInfoEssai(supabase: SupabaseClient, tenantId: string): Promise<LimiteEssaiInfo | null> {
  const { data: tenant } = await supabase.from("tenants").select("plan, created_at").eq("id", tenantId).single();
  if (!tenant || tenant.plan !== "essai") return null;

  const joursEcoules = Math.floor((Date.now() - new Date(tenant.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("role", ["apprenant", "professeur"]);
  const nbComptes = count ?? 0;

  return {
    enEssai: true,
    joursEcoules,
    joursRestants: Math.max(0, DUREE_ESSAI_JOURS - joursEcoules),
    nbComptes,
    limiteAtteinte: joursEcoules >= DUREE_ESSAI_JOURS || nbComptes >= LIMITE_COMPTES_ESSAI,
  };
}

export async function getLimiteEssai(supabase: SupabaseClient, tenantId: string | null): Promise<LimiteEssaiInfo | null> {
  if (!tenantId) return null;
  return chargerInfoEssai(supabase, tenantId);
}

// A appeler avant de creer un compte apprenant/professeur (pas pour
// admin_tenant/parent, non comptes dans la limite). Retourne un message
// pret a afficher si la limite est atteinte, sinon null.
export async function verifierLimiteEssaiPourNouveauCompte(
  supabase: SupabaseClient,
  tenantId: string | null,
  role: string,
): Promise<string | null> {
  if (!tenantId || !["apprenant", "professeur"].includes(role)) return null;

  const info = await chargerInfoEssai(supabase, tenantId);
  if (!info) return null;

  if (info.joursEcoules >= DUREE_ESSAI_JOURS) {
    return `Période d'essai de ${DUREE_ESSAI_JOURS} jours terminée. Contactez AtlasLab pour passer à un plan payant.`;
  }
  if (info.nbComptes >= LIMITE_COMPTES_ESSAI) {
    return `Limite de ${LIMITE_COMPTES_ESSAI} comptes (apprenant + professeur) atteinte pour la période d'essai. Contactez AtlasLab pour passer à un plan payant.`;
  }
  return null;
}
