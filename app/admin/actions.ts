"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionState = { error?: string; success?: boolean };

export async function createAccount(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
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

  if (!callerProfile || !["admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { error: "Action réservée aux administrateurs." };
  }

  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!nom || !email || !password || !["professeur", "apprenant"].includes(role)) {
    return { error: "Tous les champs sont requis." };
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "Impossible de créer le compte." };
  }

  const { error: insertError } = await supabase.from("users").insert({
    id: created.user.id,
    tenant_id: callerProfile.tenant_id,
    role,
    nom,
    email,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath("/admin");
  return { success: true };
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { supabase, caller: null, error: "Non authentifié." } as const;

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || !["admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { supabase, caller, error: "Action réservée aux administrateurs." } as const;
  }

  return { supabase, caller, error: null } as const;
}

export type UpdateNomState = { error?: string; success?: boolean };

export async function updateAccountNom(
  _prevState: UpdateNomState,
  formData: FormData,
): Promise<UpdateNomState> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const targetId = String(formData.get("target_id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  if (!targetId || !nom) return { error: "Le nom est requis." };

  const { error } = await supabase.from("users").update({ nom }).eq("id", targetId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export type ToggleActiveState = { error?: string };

export async function toggleAccountActive(
  _prevState: ToggleActiveState,
  formData: FormData,
): Promise<ToggleActiveState> {
  const { supabase, caller, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const targetId = String(formData.get("target_id") ?? "");
  const currentlyActif = formData.get("actif") === "true";
  if (!targetId) return { error: "Compte invalide." };

  if (targetId === caller!.id) {
    return { error: "Vous ne pouvez pas désactiver votre propre compte." };
  }

  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(targetId, {
    ban_duration: currentlyActif ? "876000h" : "none",
  });
  if (banError) return { error: banError.message };

  const { error } = await supabase
    .from("users")
    .update({ actif: !currentlyActif })
    .eq("id", targetId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {};
}
