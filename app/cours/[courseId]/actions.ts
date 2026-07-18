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
    .select("role")
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
  });

  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}`);
  return {};
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

  if (!courseId || !lessonId || !titre) return { error: "Le titre est requis." };
  if (!["contenu", "labo", "quiz", "seance_directe"].includes(type)) {
    return { error: "Type de leçon invalide." };
  }

  const { laboConfig, finalLaboType, error: laboError } = laboConfigFromForm(formData, type);
  if (laboError) return { error: laboError };

  const { error } = await supabase
    .from("lessons")
    .update({
      titre,
      type,
      contenu_markdown: contenuMarkdown || null,
      labo_type: finalLaboType,
      labo_config: laboConfig,
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

  const { error } = await supabase.from("live_sessions").insert({
    course_id: courseId,
    date_heure: new Date(dateHeure).toISOString(),
    lien_visio: lienVisio || null,
    professeur_id: callerProfile.role === "professeur" ? caller.id : null,
  });

  if (error) return { error: error.message };

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
