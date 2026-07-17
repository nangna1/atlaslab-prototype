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
