"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { supabase, caller: null, tenantId: null, error: "Non authentifié." } as const;

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", caller.id)
    .single();

  if (
    !callerProfile ||
    !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role) ||
    !callerProfile.tenant_id
  ) {
    return { supabase, caller, tenantId: null, error: "Action réservée au staff." } as const;
  }

  return { supabase, caller, tenantId: callerProfile.tenant_id as string, error: null } as const;
}

export type CreateOffreState = { error?: string; success?: boolean };

export async function createOffre(
  _prevState: CreateOffreState,
  formData: FormData,
): Promise<CreateOffreState> {
  const { supabase, caller, tenantId, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const titre = String(formData.get("titre") ?? "").trim();
  const entreprise = String(formData.get("entreprise") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const filiere = String(formData.get("filiere") ?? "").trim();
  const localisation = String(formData.get("localisation") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();

  if (!titre || !entreprise || !["stage", "emploi"].includes(type)) {
    return { error: "Titre, entreprise et type sont requis." };
  }

  const { error } = await supabase.from("offres_emploi").insert({
    tenant_id: tenantId,
    titre,
    entreprise,
    type,
    filiere: filiere || null,
    localisation: localisation || null,
    description: description || null,
    contact: contact || null,
    publiee_par: caller!.id,
  });

  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "offre_publiee",
    cibleType: "offre_emploi",
    details: { titre, entreprise, type },
  });

  revalidatePath("/admin/offres");
  revalidatePath("/offres");
  return { success: true };
}

export type ToggleOffreState = { error?: string };

export async function toggleOffreStatut(
  _prevState: ToggleOffreState,
  formData: FormData,
): Promise<ToggleOffreState> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const targetId = String(formData.get("target_id") ?? "");
  const currentStatut = String(formData.get("statut") ?? "");
  if (!targetId) return { error: "Offre invalide." };

  const { error } = await supabase
    .from("offres_emploi")
    .update({ statut: currentStatut === "ouverte" ? "fermee" : "ouverte" })
    .eq("id", targetId);
  if (error) return { error: error.message };

  revalidatePath("/admin/offres");
  revalidatePath("/offres");
  return {};
}

export async function deleteOffre(formData: FormData): Promise<void> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return;

  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) return;

  await supabase.from("offres_emploi").delete().eq("id", targetId);

  revalidatePath("/admin/offres");
  revalidatePath("/offres");
}
