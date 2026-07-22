"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAccountsCsv } from "@/lib/csv";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { verifierLimiteEssaiPourNouveauCompte, getLimiteEssai, DUREE_ESSAI_JOURS, LIMITE_COMPTES_ESSAI } from "@/lib/tenant-plan";

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

  if (!nom || !email || !password || !["professeur", "apprenant", "parent"].includes(role)) {
    return { error: "Tous les champs sont requis." };
  }

  const limiteMessage = await verifierLimiteEssaiPourNouveauCompte(supabase, callerProfile.tenant_id, role);
  if (limiteMessage) return { error: limiteMessage };

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

  const { data: tenant } = callerProfile.tenant_id
    ? await supabase.from("tenants").select("nom").eq("id", callerProfile.tenant_id).single()
    : { data: null };
  const tenantNom = tenant?.nom ?? "AtlasLab";

  const admin = createAdminClient();
  const results: ImportAccountsResult[] = [];

  // Limite du plan 'essai' (voir lib/tenant-plan.ts) : verifiee UNE FOIS ici
  // (pas par ligne, pour ne pas multiplier les requetes sur un import de
  // jusqu'a 300 lignes), puis decrementee localement au fil des insertions
  // reussies. La vraie barriere reste la RLS (20260804000000_tenant_essai_limites.sql)
  // si ce compteur local divergeait pour une raison quelconque.
  const limiteEssai = await getLimiteEssai(supabase, callerProfile.tenant_id);
  const essaiExpire = !!limiteEssai && limiteEssai.joursEcoules >= DUREE_ESSAI_JOURS;
  let comptesRestants = limiteEssai ? Math.max(0, LIMITE_COMPTES_ESSAI - limiteEssai.nbComptes) : Infinity;

  for (const row of rows) {
    if (["apprenant", "professeur"].includes(row.role)) {
      if (essaiExpire) {
        results.push({
          nom: row.nom,
          email: row.email,
          role: row.role,
          error: `Période d'essai de ${DUREE_ESSAI_JOURS} jours terminée. Contactez AtlasLab pour passer à un plan payant.`,
        });
        continue;
      }
      if (comptesRestants <= 0) {
        results.push({
          nom: row.nom,
          email: row.email,
          role: row.role,
          error: `Limite de ${LIMITE_COMPTES_ESSAI} comptes atteinte pour la période d'essai. Contactez AtlasLab pour passer à un plan payant.`,
        });
        continue;
      }
    }

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
    if (["apprenant", "professeur"].includes(row.role)) comptesRestants--;

    await sendEmail({
      to: row.email,
      subject: `Votre compte ${tenantNom} sur AtlasLab est prêt`,
      html: `<p>Bonjour ${row.nom},</p>
        <p>Un compte a été créé pour vous sur AtlasLab, la plateforme de <strong>${tenantNom}</strong>.</p>
        <p>Vos identifiants de connexion :</p>
        <ul>
          <li>Email : <strong>${row.email}</strong></li>
          <li>Mot de passe temporaire : <strong>${password}</strong></li>
        </ul>
        <p>Connectez-vous sur <a href="https://atlaslabedu.com/login">atlaslabedu.com/login</a> puis changez ce mot de passe dès que possible (menu « Mon profil »).</p>`,
    });
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

// Un professeur avec est_moderateur=true peut gerer les comptes apprenant de
// son etablissement, en plus de admin_tenant/super_admin. isFullAdmin
// distingue les deux pour les actions qui touchent des comptes non-apprenant
// (creation, professeur/admin, bypass RLS via createAdminClient) -- reservees
// aux vrais admins.
async function requireAdminOrModerator() {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) {
    return { supabase, caller: null, tenantId: null, isFullAdmin: false, error: "Non authentifié." } as const;
  }

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, tenant_id, est_moderateur")
    .eq("id", caller.id)
    .single();

  const isFullAdmin = !!callerProfile && ["admin_tenant", "super_admin"].includes(callerProfile.role);
  const isModerateur = !!callerProfile && callerProfile.role === "professeur" && callerProfile.est_moderateur;

  if (!callerProfile || (!isFullAdmin && !isModerateur)) {
    return { supabase, caller, tenantId: null, isFullAdmin: false, error: "Action réservée aux administrateurs." } as const;
  }

  return {
    supabase,
    caller,
    tenantId: callerProfile.tenant_id as string | null,
    isFullAdmin,
    error: null,
  } as const;
}

// Un moderateur ne peut agir que sur un compte apprenant de son propre
// etablissement -- verifie explicitement ici car toggleAccountActive appelle
// ensuite l'API admin Auth (createAdminClient), qui contourne entierement la
// RLS de la table users.
async function assertModeratorCanTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetId: string,
  tenantId: string | null,
) {
  const { data: target } = await supabase.from("users").select("role, tenant_id").eq("id", targetId).single();
  if (!target || target.role !== "apprenant" || target.tenant_id !== tenantId) {
    return "Vous ne pouvez gérer que les comptes élèves de votre établissement.";
  }
  return null;
}

export type UpdateNomState = { error?: string; success?: boolean };

export async function updateAccountNom(
  _prevState: UpdateNomState,
  formData: FormData,
): Promise<UpdateNomState> {
  const { supabase, caller, tenantId, isFullAdmin, error: authError } = await requireAdminOrModerator();
  if (authError) return { error: authError };

  const targetId = String(formData.get("target_id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();
  if (!targetId || !nom) return { error: "Le nom est requis." };

  if (!isFullAdmin) {
    const moderatorError = await assertModeratorCanTarget(supabase, targetId, tenantId);
    if (moderatorError) return { error: moderatorError };
  }

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
  const { supabase, caller, tenantId, isFullAdmin, error: authError } = await requireAdminOrModerator();
  if (authError) return { error: authError };

  const targetId = String(formData.get("target_id") ?? "");
  const currentlyActif = formData.get("actif") === "true";
  if (!targetId) return { error: "Compte invalide." };

  if (targetId === caller!.id) {
    return { error: "Vous ne pouvez pas désactiver votre propre compte." };
  }

  if (!isFullAdmin) {
    const moderatorError = await assertModeratorCanTarget(supabase, targetId, tenantId);
    if (moderatorError) return { error: moderatorError };
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

export type SetModerateurState = { error?: string };

export async function setModerateur(
  _prevState: SetModerateurState,
  formData: FormData,
): Promise<SetModerateurState> {
  const { supabase, caller, tenantId, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const targetId = String(formData.get("target_id") ?? "");
  const value = formData.get("value") === "true";
  if (!targetId) return { error: "Compte invalide." };

  const { data: target } = await supabase.from("users").select("role").eq("id", targetId).single();
  if (!target || target.role !== "professeur") {
    return { error: "Le statut modérateur ne peut être accordé qu'à un professeur." };
  }

  const { error } = await supabase.from("users").update({ est_moderateur: value }).eq("id", targetId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: value ? "moderateur_accorde" : "moderateur_retire",
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

  // La 2FA du compte cible s'applique aussi a une connexion via ce lien (le
  // middleware la fait respecter, voir lib/supabase/proxy.ts) -- sans le code
  // de l'utilisateur cible, la bascule resterait bloquee sur un mur TOTP.
  // Autant le dire clairement plutot que generer un lien sans issue.
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: targetUserId });
  if ((factors?.factors ?? []).some((f) => f.status === "verified")) {
    return { error: "Ce compte a la double authentification activée — connexion en tant que lui indisponible." };
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
