"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  revalidatePath("/admin/etablissement");
  revalidatePath("/cours");
  return { success: true };
}
