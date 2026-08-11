"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
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

  if (!callerProfile || !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { supabase, caller, tenantId: null, error: "Action réservée au staff." } as const;
  }

  return { supabase, caller, tenantId: callerProfile.tenant_id as string | null, error: null } as const;
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
  const { supabase, caller, tenantId, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const courseId = String(formData.get("course_id") ?? "");
  const lessonId = String(formData.get("lesson_id") ?? "");
  const submissionId = String(formData.get("submission_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!submissionId || note === "") return { error: "Note requise." };
  const noteNumber = Number(note);
  if (Number.isNaN(noteNumber)) return { error: "Note invalide." };

  const { data: updated, error } = await supabase
    .from("submissions")
    .update({ note: noteNumber })
    .eq("id", submissionId)
    .select("user_id, assignments(titre)")
    .single();

  if (error) return { error: error.message };

  const assignmentTitre = (updated?.assignments as unknown as { titre: string } | null)?.titre ?? "un devoir";
  const lien = `/cours/${courseId}/lecons/${lessonId}`;

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "devoir_note",
    cibleType: "submission",
    cibleId: submissionId,
    details: { note: noteNumber, devoir: assignmentTitre, eleve_id: updated?.user_id ?? null },
  });

  if (updated?.user_id) {
    await supabase.from("notifications").insert({
      user_id: updated.user_id,
      type: "devoir_note",
      titre: "Devoir noté",
      message: `Votre devoir "${assignmentTitre}" a été noté : ${noteNumber}/20.`,
      lien,
    });

    const { data: eleve } = await supabase
      .from("users")
      .select("email, telephone")
      .eq("id", updated.user_id)
      .single();
    if (eleve?.email) {
      await sendEmail({
        to: eleve.email,
        subject: `Votre devoir "${assignmentTitre}" a été noté`,
        html: `<p>Votre devoir <strong>${assignmentTitre}</strong> a été noté : <strong>${noteNumber}/20</strong>.</p>`,
      });
    }
    if (eleve?.telephone) {
      await sendWhatsAppTemplate({
        to: eleve.telephone,
        templateName: "atlaslab_devoir_note",
        bodyParams: [assignmentTitre, `${noteNumber}/20`],
      });
    }
  }

  revalidatePath(`/cours/${courseId}/lecons/${lessonId}`);
  return {};
}
