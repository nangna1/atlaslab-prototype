"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseCourseTemplate, insertCourseFromTemplate } from "@/lib/course-import";
import { COURSE_TEMPLATES } from "@/lib/course-templates";

export type CreateCourseState = { error?: string };

export async function createCourse(
  _prevState: CreateCourseState,
  formData: FormData,
): Promise<CreateCourseState> {
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

  const titre = String(formData.get("titre") ?? "").trim();
  const filiere = String(formData.get("filiere") ?? "").trim();
  if (!titre) return { error: "Le titre est requis." };

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      tenant_id: callerProfile.tenant_id,
      titre,
      filiere: filiere || null,
      professeur_id: callerProfile.role === "professeur" ? caller.id : null,
    })
    .select("id")
    .single();

  if (error || !course) return { error: error?.message ?? "Impossible de créer le cours." };

  redirect(`/cours/${course.id}`);
}

export type ImportCourseState = { error?: string };

export async function importCourse(
  _prevState: ImportCourseState,
  formData: FormData,
): Promise<ImportCourseState> {
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
  if (!callerProfile.tenant_id) {
    return { error: "Aucun établissement associé à ce compte." };
  }

  const templateId = String(formData.get("template_id") ?? "");
  const file = formData.get("file") as File | null;

  let raw: unknown;
  if (templateId) {
    const template = COURSE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return { error: "Modèle introuvable." };
    raw = template.data;
  } else if (file && file.size > 0) {
    const text = await file.text();
    try {
      raw = JSON.parse(text);
    } catch {
      return { error: "Fichier invalide : JSON mal formé." };
    }
  } else {
    return { error: "Choisissez un modèle ou un fichier à importer." };
  }

  const parsed = parseCourseTemplate(raw);
  if ("error" in parsed) return { error: parsed.error };

  const result = await insertCourseFromTemplate(
    supabase,
    callerProfile.tenant_id,
    callerProfile.role === "professeur" ? caller.id : null,
    parsed.data,
  );
  if ("error" in result) return { error: result.error };

  redirect(`/cours/${result.courseId}`);
}

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

export type UpdateCourseState = { error?: string; success?: boolean };

export async function updateCourse(
  _prevState: UpdateCourseState,
  formData: FormData,
): Promise<UpdateCourseState> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const courseId = String(formData.get("course_id") ?? "");
  const titre = String(formData.get("titre") ?? "").trim();
  const filiere = String(formData.get("filiere") ?? "").trim();
  if (!courseId || !titre) return { error: "Le titre est requis." };

  const { error } = await supabase
    .from("courses")
    .update({ titre, filiere: filiere || null })
    .eq("id", courseId);

  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}`);
  return { success: true };
}

export async function deleteCourse(formData: FormData): Promise<void> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return;

  const courseId = String(formData.get("course_id") ?? "");
  if (!courseId) return;

  await supabase.from("courses").delete().eq("id", courseId);

  redirect("/cours");
}
