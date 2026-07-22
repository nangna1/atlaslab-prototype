"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

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

async function requireSuperAdmin() {
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

  if (!callerProfile || callerProfile.role !== "super_admin") {
    return { supabase, caller, error: "Action réservée aux super-admins." } as const;
  }

  return { supabase, caller, error: null } as const;
}

export type TenantApprovalState = { error?: string };

export async function approveTenant(
  _prevState: TenantApprovalState,
  formData: FormData,
): Promise<TenantApprovalState> {
  const { supabase, caller, error: authError } = await requireSuperAdmin();
  if (authError) return { error: authError };

  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) return { error: "Établissement invalide." };

  const admin = createAdminClient();
  const { error } = await admin.from("tenants").update({ statut: "actif" }).eq("id", tenantId);
  if (error) return { error: error.message };

  const { data: tenantUsers } = await admin
    .from("users")
    .select("id, email, nom")
    .eq("tenant_id", tenantId)
    .eq("role", "admin_tenant");

  for (const u of tenantUsers ?? []) {
    await admin.auth.admin.updateUserById(u.id, { ban_duration: "none" });
    if (u.email) {
      await sendEmail({
        to: u.email,
        subject: "Votre établissement AtlasLab est approuvé",
        html: `<p>Bonjour ${u.nom}, votre établissement a été approuvé. Vous pouvez maintenant <a href="https://atlaslabedu.com/login">vous connecter</a>.</p>`,
      });
    }
  }

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "etablissement_approuve",
    cibleType: "tenant",
    cibleId: tenantId,
  });

  revalidatePath("/admin/etablissements");
  return {};
}

export type ChangerPlanState = { error?: string };

// Aucun moyen de paiement en ligne pour l'instant (voir README) : un
// etablissement passe de 'essai' (limite a 30 jours / 30 comptes, voir
// supabase/migrations/20260804000000_tenant_essai_limites.sql) a 'standard'
// (illimite) uniquement via cette action manuelle d'un super_admin.
export async function changerPlan(
  _prevState: ChangerPlanState,
  formData: FormData,
): Promise<ChangerPlanState> {
  const { supabase, caller, error: authError } = await requireSuperAdmin();
  if (authError) return { error: authError };

  const tenantId = String(formData.get("tenant_id") ?? "");
  const plan = String(formData.get("plan") ?? "");
  if (!tenantId || !["essai", "standard"].includes(plan)) {
    return { error: "Établissement ou plan invalide." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("tenants").update({ plan }).eq("id", tenantId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "plan_change",
    cibleType: "tenant",
    cibleId: tenantId,
    details: { plan },
  });

  revalidatePath("/admin/etablissements");
  return {};
}

export async function rejectTenant(
  _prevState: TenantApprovalState,
  formData: FormData,
): Promise<TenantApprovalState> {
  const { supabase, caller, error: authError } = await requireSuperAdmin();
  if (authError) return { error: authError };

  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) return { error: "Établissement invalide." };

  const admin = createAdminClient();
  const { error } = await admin.from("tenants").update({ statut: "refuse" }).eq("id", tenantId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "etablissement_refuse",
    cibleType: "tenant",
    cibleId: tenantId,
  });

  revalidatePath("/admin/etablissements");
  return {};
}
