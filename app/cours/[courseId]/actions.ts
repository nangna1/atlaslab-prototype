"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
