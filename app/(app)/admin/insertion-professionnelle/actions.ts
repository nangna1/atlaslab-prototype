"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isValidInsertionStatut } from "@/lib/insertions";

export type InsertionStaffState = { error?: string };

export async function upsertInsertionStaff(
  _prevState: InsertionStaffState,
  formData: FormData,
): Promise<InsertionStaffState> {
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
    !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role) ||
    !callerProfile.tenant_id
  ) {
    return { error: "Action réservée au staff." };
  }

  const targetUserId = String(formData.get("user_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const statut = String(formData.get("statut") ?? "");
  const entreprise = String(formData.get("entreprise") ?? "").trim();
  const poste = String(formData.get("poste") ?? "").trim();

  if (!targetUserId || !courseId || !isValidInsertionStatut(statut)) {
    return { error: "Champs invalides." };
  }

  const { error } = await supabase.from("insertions_professionnelles").upsert(
    {
      tenant_id: callerProfile.tenant_id,
      user_id: targetUserId,
      course_id: courseId,
      statut,
      entreprise: entreprise || null,
      poste: poste || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,course_id" },
  );

  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller.id,
    tenantId: callerProfile.tenant_id,
    action: "insertion_mise_a_jour",
    cibleType: "insertion",
    cibleId: targetUserId,
    details: { course_id: courseId, statut },
  });

  revalidatePath("/admin/insertion-professionnelle");
  return {};
}
