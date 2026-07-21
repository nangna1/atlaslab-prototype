"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

// Contrairement a requireStaff() (offres/decrochage-style, qui inclut
// professeur), les donnees financieres restent reservees a admin_tenant/
// super_admin -- decision produit confirmee, voir le plan de ce module.
async function requireStaffFinances() {
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
    !["admin_tenant", "super_admin"].includes(callerProfile.role) ||
    !callerProfile.tenant_id
  ) {
    return { supabase, caller, tenantId: null, error: "Action réservée à l'administration de l'établissement." } as const;
  }

  return { supabase, caller, tenantId: callerProfile.tenant_id as string, error: null } as const;
}

export type CreateFraisState = { error?: string; success?: boolean };

export async function createFrais(
  _prevState: CreateFraisState,
  formData: FormData,
): Promise<CreateFraisState> {
  const { supabase, caller, tenantId, error: authError } = await requireStaffFinances();
  if (authError) return { error: authError };

  const libelle = String(formData.get("libelle") ?? "").trim();
  const filiere = String(formData.get("filiere") ?? "").trim();
  const montantRaw = String(formData.get("montant") ?? "").trim();
  const echeance = String(formData.get("echeance") ?? "").trim();

  const montant = Number(montantRaw.replace(",", "."));
  if (!libelle || !Number.isFinite(montant) || montant <= 0) {
    return { error: "Libellé et montant (positif) sont requis." };
  }

  const { error } = await supabase.from("frais_scolarite").insert({
    tenant_id: tenantId,
    libelle,
    filiere: filiere || null,
    montant,
    echeance: echeance || null,
    cree_par: caller!.id,
  });

  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "frais_cree",
    cibleType: "frais_scolarite",
    details: { libelle, montant, filiere: filiere || null },
  });

  revalidatePath("/admin/frais-scolarite");
  revalidatePath("/mes-frais");
  return { success: true };
}

export type DeleteFraisState = { error?: string };

export async function deleteFrais(
  _prevState: DeleteFraisState,
  formData: FormData,
): Promise<DeleteFraisState> {
  const { supabase, caller, tenantId, error: authError } = await requireStaffFinances();
  if (authError) return { error: authError };

  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) return { error: "Frais invalide." };

  const { error } = await supabase.from("frais_scolarite").delete().eq("id", targetId);
  // Bloque par la base si des paiements referencent deja ce frais (aucune
  // cascade volontairement, voir la migration) : message brut de Postgres
  // dans ce cas, pas de gestion speciale -- un frais deja paye ne doit pas
  // pouvoir disparaitre silencieusement de l'historique.
  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "frais_supprime",
    cibleType: "frais_scolarite",
    cibleId: targetId,
  });

  revalidatePath("/admin/frais-scolarite");
  revalidatePath("/mes-frais");
  return {};
}
