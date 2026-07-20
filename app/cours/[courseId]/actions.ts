"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { generateJaasToken, jaasRoomName, isJaasConfigured } from "@/lib/jaas";

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

export type EnrollState = { error?: string; success?: boolean };

export async function enrollStudent(
  _prevState: EnrollState,
  formData: FormData,
): Promise<EnrollState> {
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

  if (!callerProfile || !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { error: "Action réservée au staff." };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!courseId || !userId) {
    return { error: "Sélectionnez un élève." };
  }

  const { error } = await supabase.from("enrollments").insert({
    tenant_id: callerProfile.tenant_id,
    user_id: userId,
    course_id: courseId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}`);
  return { success: true };
}

export type CreateModuleState = { error?: string };

export async function createModule(
  _prevState: CreateModuleState,
  formData: FormData,
): Promise<CreateModuleState> {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { error: "Non authentifié." };

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { error: "Action réservée au staff." };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const titre = String(formData.get("titre") ?? "").trim();
  if (!courseId || !titre) return { error: "Le titre est requis." };

  const { count } = await supabase
    .from("modules")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  const { error } = await supabase.from("modules").insert({
    course_id: courseId,
    titre,
    ordre: (count ?? 0) + 1,
  });

  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}`);
  return {};
}

export type UpdateModuleState = { error?: string; success?: boolean };

export async function updateModule(
  _prevState: UpdateModuleState,
  formData: FormData,
): Promise<UpdateModuleState> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const courseId = String(formData.get("course_id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  const titre = String(formData.get("titre") ?? "").trim();
  if (!courseId || !moduleId || !titre) return { error: "Le titre est requis." };

  const { error } = await supabase.from("modules").update({ titre }).eq("id", moduleId);
  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}`);
  return { success: true };
}

export async function deleteModule(formData: FormData): Promise<void> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return;

  const courseId = String(formData.get("course_id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  if (!courseId || !moduleId) return;

  await supabase.from("modules").delete().eq("id", moduleId);

  revalidatePath(`/cours/${courseId}`);
}

export type CreateLessonState = { error?: string };

// Piece jointe de lecon (PDF/Word/PPT deja prepares par le professeur) --
// aucune tentative de parsing/structuration, juste un fichier stocke tel
// quel et consultable depuis la lecon. Chemin non lie a l'id de la lecon
// (peut etre televerse avant sa creation) : dossier tenant_id + nom aleatoire.
async function uploadLessonDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  file: File,
): Promise<{ url: string; nom: string } | { error: string }> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${tenantId}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("lecons-documents")
    .upload(path, file, { contentType: file.type });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("lecons-documents").getPublicUrl(path);
  return { url: data.publicUrl, nom: file.name };
}

export async function createLesson(
  _prevState: CreateLessonState,
  formData: FormData,
): Promise<CreateLessonState> {
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

  if (!callerProfile || !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { error: "Action réservée au staff." };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  const titre = String(formData.get("titre") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const contenuMarkdown = String(formData.get("contenu_markdown") ?? "").trim();
  const laboType = String(formData.get("labo_type") ?? "");
  const netlist = String(formData.get("netlist") ?? "").trim();
  const embedUrl = String(formData.get("embed_url") ?? "").trim();
  const documentFile = formData.get("document") as File | null;

  if (!courseId || !moduleId || !titre) return { error: "Le titre est requis." };
  if (!["contenu", "labo", "quiz", "seance_directe"].includes(type)) {
    return { error: "Type de leçon invalide." };
  }

  let laboConfig: { netlist?: string; embed_url?: string } | null = null;
  let finalLaboType: string | null = null;
  if (type === "labo") {
    if (laboType === "eecircuit") {
      laboConfig = { netlist };
      finalLaboType = "eecircuit";
    } else if (laboType === "circuitverse") {
      laboConfig = { embed_url: embedUrl };
      finalLaboType = "circuitverse";
    } else {
      return { error: "Choisissez un type de laboratoire." };
    }
  }

  const { quizQuestions, error: quizError } = quizQuestionsFromForm(formData, type);
  if (quizError) return { error: quizError };

  let pieceJointeUrl: string | null = null;
  let pieceJointeNom: string | null = null;
  if (documentFile && documentFile.size > 0 && callerProfile.tenant_id) {
    const uploaded = await uploadLessonDocument(supabase, callerProfile.tenant_id, documentFile);
    if ("error" in uploaded) return { error: uploaded.error };
    pieceJointeUrl = uploaded.url;
    pieceJointeNom = uploaded.nom;
  }

  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId);

  const { error } = await supabase.from("lessons").insert({
    module_id: moduleId,
    titre,
    ordre: (count ?? 0) + 1,
    type,
    contenu_markdown: contenuMarkdown || null,
    labo_type: finalLaboType,
    labo_config: laboConfig,
    quiz_questions: quizQuestions,
    piece_jointe_url: pieceJointeUrl,
    piece_jointe_nom: pieceJointeNom,
  });

  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}`);
  return {};
}

type QuizQuestion = { question: string; options: string[]; correct: number };

function quizQuestionsFromForm(formData: FormData, type: string) {
  if (type !== "quiz") return { quizQuestions: null, error: null };

  const raw = String(formData.get("quiz_questions") ?? "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { quizQuestions: null, error: "Questions de quiz invalides." };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { quizQuestions: null, error: "Ajoutez au moins une question." };
  }

  const questions: QuizQuestion[] = [];
  for (const item of parsed) {
    if (
      !item ||
      typeof item.question !== "string" ||
      !item.question.trim() ||
      !Array.isArray(item.options)
    ) {
      return { quizQuestions: null, error: "Chaque question doit avoir un texte et des options." };
    }
    const options = item.options.filter((o: unknown) => typeof o === "string" && o.trim());
    if (options.length < 2) {
      return { quizQuestions: null, error: "Chaque question doit avoir au moins 2 options." };
    }
    const correct = Number(item.correct);
    if (!Number.isInteger(correct) || correct < 0 || correct >= item.options.length) {
      return { quizQuestions: null, error: "Bonne réponse invalide." };
    }
    questions.push({ question: item.question.trim(), options, correct });
  }

  return { quizQuestions: questions, error: null };
}

function laboConfigFromForm(formData: FormData, type: string) {
  const laboType = String(formData.get("labo_type") ?? "");
  const netlist = String(formData.get("netlist") ?? "").trim();
  const embedUrl = String(formData.get("embed_url") ?? "").trim();

  if (type !== "labo") return { laboConfig: null, finalLaboType: null, error: null };

  if (laboType === "eecircuit") {
    return { laboConfig: { netlist }, finalLaboType: "eecircuit", error: null };
  }
  if (laboType === "circuitverse") {
    return { laboConfig: { embed_url: embedUrl }, finalLaboType: "circuitverse", error: null };
  }
  return { laboConfig: null, finalLaboType: null, error: "Choisissez un type de laboratoire." };
}

export type UpdateLessonState = { error?: string; success?: boolean };

export async function updateLesson(
  _prevState: UpdateLessonState,
  formData: FormData,
): Promise<UpdateLessonState> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const courseId = String(formData.get("course_id") ?? "");
  const lessonId = String(formData.get("lesson_id") ?? "");
  const titre = String(formData.get("titre") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const contenuMarkdown = String(formData.get("contenu_markdown") ?? "").trim();
  const documentFile = formData.get("document") as File | null;
  const removeDocument = formData.get("remove_document") === "on";

  if (!courseId || !lessonId || !titre) return { error: "Le titre est requis." };
  if (!["contenu", "labo", "quiz", "seance_directe"].includes(type)) {
    return { error: "Type de leçon invalide." };
  }

  const { laboConfig, finalLaboType, error: laboError } = laboConfigFromForm(formData, type);
  if (laboError) return { error: laboError };

  const { quizQuestions, error: quizError } = quizQuestionsFromForm(formData, type);
  if (quizError) return { error: quizError };

  let documentUpdate: { piece_jointe_url: string | null; piece_jointe_nom: string | null } | Record<string, never> = {};
  if (documentFile && documentFile.size > 0) {
    const {
      data: { user: caller },
    } = await supabase.auth.getUser();
    const { data: callerProfile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", caller!.id)
      .single();
    if (!callerProfile?.tenant_id) return { error: "Établissement introuvable." };
    const uploaded = await uploadLessonDocument(supabase, callerProfile.tenant_id, documentFile);
    if ("error" in uploaded) return { error: uploaded.error };
    documentUpdate = { piece_jointe_url: uploaded.url, piece_jointe_nom: uploaded.nom };
  } else if (removeDocument) {
    documentUpdate = { piece_jointe_url: null, piece_jointe_nom: null };
  }

  const { error } = await supabase
    .from("lessons")
    .update({
      titre,
      type,
      contenu_markdown: contenuMarkdown || null,
      labo_type: finalLaboType,
      labo_config: laboConfig,
      quiz_questions: quizQuestions,
      ...documentUpdate,
    })
    .eq("id", lessonId);

  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}`);
  return { success: true };
}

export async function deleteLesson(formData: FormData): Promise<void> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return;

  const courseId = String(formData.get("course_id") ?? "");
  const lessonId = String(formData.get("lesson_id") ?? "");
  if (!courseId || !lessonId) return;

  await supabase.from("lessons").delete().eq("id", lessonId);

  revalidatePath(`/cours/${courseId}`);
}

export type CreateSeanceState = { error?: string };

export async function createSeance(
  _prevState: CreateSeanceState,
  formData: FormData,
): Promise<CreateSeanceState> {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { error: "Non authentifié." };

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { error: "Action réservée au staff." };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const dateHeure = String(formData.get("date_heure") ?? "");
  const lienVisio = String(formData.get("lien_visio") ?? "").trim();

  if (!courseId || !dateHeure) return { error: "La date/heure est requise." };

  const isoDateHeure = new Date(dateHeure).toISOString();
  const { error } = await supabase.from("live_sessions").insert({
    course_id: courseId,
    date_heure: isoDateHeure,
    lien_visio: lienVisio || null,
    professeur_id: callerProfile.role === "professeur" ? caller.id : null,
  });

  if (error) return { error: error.message };

  const { data: course } = await supabase.from("courses").select("titre").eq("id", courseId).single();
  const dateLabel = new Date(isoDateHeure).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  const lien = `/cours/${courseId}`;

  const { data: inscriptions } = await supabase
    .from("enrollments")
    .select("user_id, users(email, telephone)")
    .eq("course_id", courseId);

  const eleves = (inscriptions ?? []) as unknown as {
    user_id: string;
    users: { email: string | null; telephone: string | null } | null;
  }[];

  if (eleves.length > 0) {
    await supabase.from("notifications").insert(
      eleves.map((e) => ({
        user_id: e.user_id,
        type: "seance_programmee",
        titre: "Nouvelle séance programmée",
        message: `Une séance pour "${course?.titre ?? "votre cours"}" est programmée le ${dateLabel}.`,
        lien,
      })),
    );

    for (const eleve of eleves) {
      if (eleve.users?.email) {
        await sendEmail({
          to: eleve.users.email,
          subject: `Nouvelle séance programmée — ${course?.titre ?? ""}`,
          html: `<p>Une séance pour <strong>${course?.titre ?? "votre cours"}</strong> est programmée le <strong>${dateLabel}</strong>.</p>`,
        });
      }
      if (eleve.users?.telephone) {
        await sendWhatsAppTemplate({
          to: eleve.users.telephone,
          templateName: "atlaslab_seance_programmee",
          bodyParams: [course?.titre ?? "votre cours", dateLabel],
        });
      }
    }
  }

  revalidatePath(`/cours/${courseId}`);
  return {};
}

export async function deleteSeance(formData: FormData): Promise<void> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return;

  const courseId = String(formData.get("course_id") ?? "");
  const seanceId = String(formData.get("seance_id") ?? "");
  if (!courseId || !seanceId) return;

  await supabase.from("live_sessions").delete().eq("id", seanceId);

  revalidatePath(`/cours/${courseId}`);
}

export type MarkAttendanceState = { error?: string; success?: boolean };

export async function markAttendance(
  _prevState: MarkAttendanceState,
  formData: FormData,
): Promise<MarkAttendanceState> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const seanceId = String(formData.get("seance_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  if (!seanceId || !courseId) return { error: "Séance invalide." };

  const rows: { live_session_id: string; user_id: string; statut: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("statut_") || !value) continue;
    const userId = key.slice("statut_".length);
    if (!["present", "absent", "retard"].includes(String(value))) continue;
    rows.push({ live_session_id: seanceId, user_id: userId, statut: String(value) });
  }
  if (rows.length === 0) return { error: "Aucun statut sélectionné." };

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "live_session_id,user_id" });
  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}`);
  return { success: true };
}

export type VideoTokenResult = { token: string; roomName: string; appId: string } | { error: string };

// Genere un jeton JaaS (JWT) pour rejoindre une seance en tant que
// moderateur (staff) ou participant simple. Le statut moderateur est
// determine cote serveur a partir du role reel de l'appelant, jamais fait
// confiance a une valeur venue du client. L'autorisation d'acces a la
// seance elle-meme s'appuie sur la RLS de live_sessions (si le select
// echoue, l'appelant n'a pas le droit de voir cette seance).
export async function getVideoToken(seanceId: string): Promise<VideoTokenResult> {
  if (!isJaasConfigured()) return { error: "Visio non configurée sur cette plateforme." };

  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { error: "Non authentifié." };

  const { data: seance } = await supabase
    .from("live_sessions")
    .select("id")
    .eq("id", seanceId)
    .single();
  if (!seance) return { error: "Séance introuvable." };

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, nom, email")
    .eq("id", caller.id)
    .single();
  if (!callerProfile) return { error: "Profil introuvable." };

  const moderator = ["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role);

  const token = generateJaasToken({
    seanceId,
    userId: caller.id,
    nom: callerProfile.nom,
    email: callerProfile.email,
    moderator,
  });
  if (!token) return { error: "Visio non configurée sur cette plateforme." };

  return {
    token,
    roomName: jaasRoomName(seanceId),
    appId: process.env.JAAS_APP_ID!,
  };
}
