"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type UpdateProfileState = { error?: string; success?: boolean };

export async function updateOwnProfile(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const nom = String(formData.get("nom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();

  if (!nom) return { error: "Le nom est requis." };

  // Client service_role : la policy RLS d'update sur users est volontairement
  // reservee a admin_tenant/super_admin (voir migration 20260717050000), pour
  // empecher qu'un apprenant ne s'auto-elevate en modifiant sa propre colonne
  // "role" via un appel direct. Ici on bypass RLS mais on n'ecrit QUE
  // nom/telephone -- jamais role/tenant_id/actif, qui ne sont meme pas lus
  // depuis le formulaire. La whitelist est le code ci-dessous, pas une
  // donnee envoyee par le client.
  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ nom, telephone: telephone || null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profil");
  revalidatePath("/cours");
  return { success: true };
}
