"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { supabase, error: "Non authentifié." } as const;

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { supabase, error: "Action réservée au staff." } as const;
  }

  return { supabase, error: null } as const;
}

export type CreateAssignmentState = { error?: string };

export async function createAssignment(
  _prevState: CreateAssignmentState,
  formData: FormData,
): Promise<CreateAssignmentState> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const courseId = String(formData.get("course_id") ?? "");
  const lessonId = String(formData.get("lesson_id") ?? "");
  const titre = String(formData.get("titre") ?? "").trim();
  const dateLimite = String(formData.get("date_limite") ?? "");

  if (!lessonId || !titre) return { error: "Le titre est requis." };

  const { error } = await supabase.from("assignments").insert({
    lesson_id: lessonId,
    titre,
    date_limite: dateLimite ? new Date(dateLimite).toISOString() : null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}/lecons/${lessonId}`);
  return {};
}

export type SubmitAssignmentState = { error?: string; success?: boolean };

export async function submitAssignment(
  _prevState: SubmitAssignmentState,
  formData: FormData,
): Promise<SubmitAssignmentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const courseId = String(formData.get("course_id") ?? "");
  const lessonId = String(formData.get("lesson_id") ?? "");
  const assignmentId = String(formData.get("assignment_id") ?? "");
  const contenu = String(formData.get("contenu") ?? "").trim();
  const fichierUrl = String(formData.get("fichier_url") ?? "").trim();

  if (!assignmentId || (!contenu && !fichierUrl)) {
    return { error: "Réponse ou lien de fichier requis." };
  }

  const { error } = await supabase.from("submissions").upsert(
    {
      assignment_id: assignmentId,
      user_id: user.id,
      contenu: contenu || null,
      fichier_url: fichierUrl || null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,user_id" },
  );

  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}/lecons/${lessonId}`);
  return { success: true };
}

export type GradeSubmissionState = { error?: string };

export async function gradeSubmission(
  _prevState: GradeSubmissionState,
  formData: FormData,
): Promise<GradeSubmissionState> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const courseId = String(formData.get("course_id") ?? "");
  const lessonId = String(formData.get("lesson_id") ?? "");
  const submissionId = String(formData.get("submission_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!submissionId || note === "") return { error: "Note requise." };
  const noteNumber = Number(note);
  if (Number.isNaN(noteNumber)) return { error: "Note invalide." };

  const { error } = await supabase
    .from("submissions")
    .update({ note: noteNumber })
    .eq("id", submissionId);

  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}/lecons/${lessonId}`);
  return {};
}
