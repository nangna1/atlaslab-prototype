"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAccountsCsv } from "@/lib/csv";
import { logAudit } from "@/lib/audit";

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
  const telephone = String(formData.get("telephone") ?? "").trim();
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
    telephone: telephone || null,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  await logAudit(supabase, {
    acteurId: caller.id,
    tenantId: callerProfile.tenant_id,
    action: "compte_cree",
    cibleType: "compte",
    cibleId: created.user.id,
    details: { nom, email, role },
  });

  revalidatePath("/admin");
  return { success: true };
}

function generatePassword() {
  return randomBytes(8).toString("base64url");
}

export type ImportAccountsResult = {
  nom: string;
  email: string;
  role: string;
  password?: string;
  error?: string;
};

export type ImportAccountsState = {
  error?: string;
  results?: ImportAccountsResult[];
};

const MAX_IMPORT_ROWS = 300;

export async function importAccounts(
  _prevState: ImportAccountsState,
  formData: FormData,
): Promise<ImportAccountsState> {
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

  const file = formData.get("fichier");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choisissez un fichier CSV." };
  }

  const text = await file.text();
  const { rows, errors: parseErrors } = parseAccountsCsv(text);

  if (rows.length === 0) {
    return { error: parseErrors[0]?.message ?? "Aucune ligne valide dans le fichier." };
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `Trop de comptes dans le fichier (limite : ${MAX_IMPORT_ROWS}).` };
  }

  const admin = createAdminClient();
  const results: ImportAccountsResult[] = [];

  for (const row of rows) {
    const password = row.motDePasse ?? generatePassword();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: row.email,
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      results.push({
        nom: row.nom,
        email: row.email,
        role: row.role,
        error: createError?.message ?? "Impossible de créer le compte.",
      });
      continue;
    }

    const { error: insertError } = await supabase.from("users").insert({
      id: created.user.id,
      tenant_id: callerProfile.tenant_id,
      role: row.role,
      nom: row.nom,
      email: row.email,
      telephone: row.telephone ?? null,
    });

    if (insertError) {
      results.push({ nom: row.nom, email: row.email, role: row.role, error: insertError.message });
      continue;
    }

    results.push({ nom: row.nom, email: row.email, role: row.role, password });
  }

  const created = results.filter((r) => !r.error);
  if (created.length > 0) {
    await logAudit(supabase, {
      acteurId: caller.id,
      tenantId: callerProfile.tenant_id,
      action: "comptes_importes",
      cibleType: "compte",
      details: { count: created.length, emails: created.map((r) => r.email) },
    });
  }

  revalidatePath("/admin");

  const skipped = parseErrors.length > 0 ? `${parseErrors.length} ligne(s) ignorée(s) — voir le format attendu.` : undefined;

  return { results, error: skipped };
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { supabase, caller: null, tenantId: null, error: "Non authentifié." } as const;

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || !["admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { supabase, caller, tenantId: null, error: "Action réservée aux administrateurs." } as const;
  }

  return { supabase, caller, tenantId: callerProfile.tenant_id as string | null, error: null } as const;
}

export type UpdateNomState = { error?: string; success?: boolean };

export async function updateAccountNom(
  _prevState: UpdateNomState,
  formData: FormData,
): Promise<UpdateNomState> {
  const { supabase, caller, tenantId, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const targetId = String(formData.get("target_id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();
  if (!targetId || !nom) return { error: "Le nom est requis." };

  const { error } = await supabase
    .from("users")
    .update({ nom, telephone: telephone || null })
    .eq("id", targetId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "compte_renomme",
    cibleType: "compte",
    cibleId: targetId,
    details: { nom, telephone: telephone || null },
  });

  revalidatePath("/admin");
  return { success: true };
}

export type ToggleActiveState = { error?: string };

export async function toggleAccountActive(
  _prevState: ToggleActiveState,
  formData: FormData,
): Promise<ToggleActiveState> {
  const { supabase, caller, tenantId, error: authError } = await requireAdmin();
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

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: currentlyActif ? "compte_desactive" : "compte_reactive",
    cibleType: "compte",
    cibleId: targetId,
  });

  revalidatePath("/admin");
  return {};
}

export type LoginAsResult = { error?: string; actionLink?: string };

const SITE_URL = "https://atlaslabedu.com";

async function mintSignInLink(email: string): Promise<LoginAsResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${SITE_URL}/auth/callback?next=/cours` },
  });

  if (error || !data?.properties?.action_link) {
    return { error: error?.message ?? "Impossible de générer le lien de connexion." };
  }
  return { actionLink: data.properties.action_link };
}

// Lien pour revenir à SON PROPRE compte après avoir bascule sur un autre —
// les cookies de session sont partages par onglet/navigateur, retaper son mot
// de passe serait le seul autre moyen de revenir une fois qu'on a bascule.
export async function generateOwnReturnLink(): Promise<LoginAsResult> {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller?.email) return { error: "Non authentifié." };

  return mintSignInLink(caller.email);
}

// "Se connecter en tant que" : admin_tenant (son propre etablissement) ou
// super_admin peuvent generer un lien de connexion pour un autre compte, sans
// connaitre son mot de passe -- utile pour verifier/demontrer une vue sans
// jongler avec plusieurs comptes. Jamais vers un compte super_admin
// (escalade de privilege), jamais vers un compte desactive.
export async function generateLoginAsLink(targetUserId: string): Promise<LoginAsResult> {
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

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("users")
    .select("email, role, tenant_id, actif")
    .eq("id", targetUserId)
    .single();

  if (!target?.email) return { error: "Compte introuvable." };
  if (target.role === "super_admin") return { error: "Impossible de se connecter en tant que super-admin." };
  if (target.actif === false) return { error: "Ce compte est désactivé." };
  if (callerProfile.role === "admin_tenant" && target.tenant_id !== callerProfile.tenant_id) {
    return { error: "Ce compte n'appartient pas à votre établissement." };
  }

  await logAudit(supabase, {
    acteurId: caller.id,
    tenantId: callerProfile.tenant_id,
    action: "connexion_en_tant_que",
    cibleType: "compte",
    cibleId: targetUserId,
  });

  return mintSignInLink(target.email);
}
