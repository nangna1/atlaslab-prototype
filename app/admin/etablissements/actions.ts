"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreateTenantState = { error?: string; success?: boolean };

export async function createTenant(
  _prevState: CreateTenantState,
  formData: FormData,
): Promise<CreateTenantState> {
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

  if (!callerProfile || callerProfile.role !== "super_admin") {
    return { error: "Action réservée aux super-admins." };
  }

  const nom = String(formData.get("nom") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const adminNom = String(formData.get("admin_nom") ?? "").trim();
  const adminEmail = String(formData.get("admin_email") ?? "").trim();
  const adminPassword = String(formData.get("admin_password") ?? "");

  if (!nom || !slug || !adminNom || !adminEmail || !adminPassword) {
    return { error: "Tous les champs sont requis." };
  }

  // Client service_role : necessaire pour creer l'utilisateur Auth, et pour
  // inserer sa ligne public.users dans un tenant qui n'est pas celui de
  // l'appelant (super_admin a tenant_id JWT null, la policy users_insert
  // exige tenant_id = jwt tenant_id, donc le client de session ne peut pas
  // ecrire dans un tenant qui vient d'etre cree).
  const admin = createAdminClient();

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ nom, slug })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    return { error: tenantError?.message ?? "Impossible de créer l'établissement." };
  }

  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });

  if (createUserError || !created.user) {
    return { error: createUserError?.message ?? "Impossible de créer le compte admin." };
  }

  const { error: insertError } = await admin.from("users").insert({
    id: created.user.id,
    tenant_id: tenant.id,
    role: "admin_tenant",
    nom: adminNom,
    email: adminEmail,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/admin/etablissements");
  return { success: true };
}
