"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSufficientContrast } from "@/lib/color-contrast";
import { saveTenantCinetPayConfig } from "@/lib/tenant-cinetpay";
import { logAudit } from "@/lib/audit";

export type UpdateBrandingState = { error?: string; success?: boolean };

export async function updateBranding(
  _prevState: UpdateBrandingState,
  formData: FormData,
): Promise<UpdateBrandingState> {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { error: "Non authentifié." };

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", caller.id)
    .single();

  if (
    !callerProfile ||
    !["admin_tenant", "super_admin"].includes(callerProfile.role) ||
    !callerProfile.tenant_id
  ) {
    return { error: "Action réservée aux administrateurs d'un établissement." };
  }

  const tenantId = callerProfile.tenant_id;
  const couleurPrimaire = String(formData.get("couleur_primaire") ?? "").trim();
  const adresse = String(formData.get("adresse") ?? "").trim();
  const numeroAgrement = String(formData.get("numero_agrement") ?? "").trim();
  const representantLegal = String(formData.get("representant_legal") ?? "").trim();
  const certificatModele = String(formData.get("certificat_modele") ?? "").trim();
  const logoFile = formData.get("logo") as File | null;

  if (couleurPrimaire && !hasSufficientContrast(couleurPrimaire)) {
    return {
      error: "Cette couleur est trop claire : le texte des boutons ne serait plus lisible. Choisissez une teinte plus foncée.",
    };
  }

  const updates: Record<string, string> = {};
  if (couleurPrimaire) updates.couleur_primaire = couleurPrimaire;
  if (adresse) updates.adresse = adresse;
  if (numeroAgrement) updates.numero_agrement = numeroAgrement;
  if (representantLegal) updates.representant_legal = representantLegal;
  if (["classique", "moderne", "sceau"].includes(certificatModele)) {
    updates.certificat_modele = certificatModele;
  }

  if (logoFile && logoFile.size > 0) {
    const ext = logoFile.name.split(".").pop() || "png";
    const path = `${tenantId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type });

    if (uploadError) return { error: uploadError.message };

    const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(path);
    updates.logo_url = `${publicUrlData.publicUrl}?v=${Date.now()}`;
  }

  if (Object.keys(updates).length === 0) {
    return { error: "Rien à enregistrer." };
  }

  const { error } = await supabase.from("tenants").update(updates).eq("id", tenantId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller.id,
    tenantId,
    action: "etablissement_personnalise",
    cibleType: "tenant",
    cibleId: tenantId,
    details: { champs: Object.keys(updates) },
  });

  revalidatePath("/admin/etablissement");
  revalidatePath("/cours");
  return { success: true };
}

export type EnregistrerConfigCinetPayState = { error?: string; success?: boolean };

/**
 * Chaque etablissement associe son propre compte marchand CinetPay --
 * jamais un compte plateforme partage (voir lib/tenant-cinetpay.ts). Ecrit
 * via le client service-role car tenant_paiement_config n'a aucune policy
 * RLS (deny-all meme pour admin_tenant) : cette action EST le seul chemin
 * d'ecriture legitime, garde par la meme verification de role que
 * updateBranding ci-dessus.
 */
export async function enregistrerConfigCinetPay(
  _prevState: EnregistrerConfigCinetPayState,
  formData: FormData,
): Promise<EnregistrerConfigCinetPayState> {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { error: "Non authentifié." };

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", caller.id)
    .single();

  if (
    !callerProfile ||
    !["admin_tenant", "super_admin"].includes(callerProfile.role) ||
    !callerProfile.tenant_id
  ) {
    return { error: "Action réservée aux administrateurs d'un établissement." };
  }

  const apiKey = String(formData.get("api_key") ?? "").trim();
  const siteId = String(formData.get("site_id") ?? "").trim();
  const secretKey = String(formData.get("secret_key") ?? "").trim();

  if (!apiKey || !siteId || !secretKey) {
    return { error: "Clé API, Site ID et Clé secrète sont tous requis." };
  }

  const admin = createAdminClient();
  await saveTenantCinetPayConfig(admin, callerProfile.tenant_id, { apiKey, siteId, secretKey });

  await logAudit(supabase, {
    acteurId: caller.id,
    tenantId: callerProfile.tenant_id,
    action: "paiement_gateway_configure",
    cibleType: "tenant",
    cibleId: callerProfile.tenant_id,
    details: { gateway: "cinetpay" },
  });

  revalidatePath("/admin/etablissement");
  return { success: true };
}
