"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
