"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidInsertionStatut } from "@/lib/insertions";

export type InsertionSelfState = { error?: string; success?: boolean };

export async function upsertInsertionSelf(
  _prevState: InsertionSelfState,
  formData: FormData,
): Promise<InsertionSelfState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.tenant_id || profile.role !== "apprenant") {
    return { error: "Action réservée aux apprenants." };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const statut = String(formData.get("statut") ?? "");
  const entreprise = String(formData.get("entreprise") ?? "").trim();
  const poste = String(formData.get("poste") ?? "").trim();

  if (!courseId || !isValidInsertionStatut(statut)) return { error: "Statut invalide." };

  const { error } = await supabase.from("insertions_professionnelles").upsert(
    {
      tenant_id: profile.tenant_id,
      user_id: user.id,
      course_id: courseId,
      statut,
      entreprise: entreprise || null,
      poste: poste || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,course_id" },
  );

  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}/certificat`);
  return { success: true };
}
