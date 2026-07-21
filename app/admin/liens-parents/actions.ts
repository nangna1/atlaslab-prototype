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
    !["admin_tenant", "super_admin"].includes(callerProfile.role) ||
    !callerProfile.tenant_id
  ) {
    return { supabase, caller, tenantId: null, error: "Action réservée aux administrateurs." } as const;
  }

  return { supabase, caller, tenantId: callerProfile.tenant_id as string, error: null } as const;
}

export type CreerLienState = { error?: string; success?: boolean };

export async function creerLien(
  _prevState: CreerLienState,
  formData: FormData,
): Promise<CreerLienState> {
  const { supabase, caller, tenantId, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const parentId = String(formData.get("parent_id") ?? "");
  const enfantId = String(formData.get("enfant_id") ?? "");
  if (!parentId || !enfantId) return { error: "Parent et élève sont requis." };

  const { error } = await supabase.from("parents_enfants").insert({
    tenant_id: tenantId,
    parent_id: parentId,
    enfant_id: enfantId,
  });

  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "lien_parent_cree",
    cibleType: "parents_enfants",
    details: { parentId, enfantId },
  });

  revalidatePath("/admin/liens-parents");
  return { success: true };
}

export type SupprimerLienState = { error?: string };

export async function supprimerLien(
  _prevState: SupprimerLienState,
  formData: FormData,
): Promise<SupprimerLienState> {
  const { supabase, caller, tenantId, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) return { error: "Lien invalide." };

  const { error } = await supabase.from("parents_enfants").delete().eq("id", targetId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "lien_parent_supprime",
    cibleType: "parents_enfants",
    cibleId: targetId,
  });

  revalidatePath("/admin/liens-parents");
  return {};
}
