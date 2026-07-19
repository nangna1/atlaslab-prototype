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

  // Le formulaire n'est affiché côté UI que si le cours est déjà terminé à
  // 100%, mais un POST direct pourrait sinon fabriquer une insertion pour un
  // cours jamais suivi — ces chiffres alimentent le rapport d'impact, ils
  // doivent rester fiables. Même calcul que la page certificat.
  type Module = { lessons: { id: string }[] | null };
  const { data: course } = await supabase
    .from("courses")
    .select("id, modules(lessons(id))")
    .eq("id", courseId)
    .single();
  if (!course) return { error: "Cours introuvable." };

  const lessonIds = ((course.modules ?? []) as Module[]).flatMap((m) => (m.lessons ?? []).map((l) => l.id));
  if (lessonIds.length === 0) return { error: "Ce cours n'est pas encore terminé." };

  const { data: progressRows } = await supabase
    .from("progress")
    .select("lesson_id")
    .eq("user_id", user.id)
    .eq("statut", "termine")
    .in("lesson_id", lessonIds);

  if ((progressRows ?? []).length !== lessonIds.length) {
    return { error: "Ce cours n'est pas encore terminé à 100%." };
  }

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
