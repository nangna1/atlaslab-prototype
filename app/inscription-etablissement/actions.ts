"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

export type SignupTenantState = { error?: string; success?: boolean };

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function signupTenant(
  _prevState: SignupTenantState,
  formData: FormData,
): Promise<SignupTenantState> {
  const nom = String(formData.get("nom") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const adminNom = String(formData.get("admin_nom") ?? "").trim();
  const adminEmail = String(formData.get("admin_email") ?? "").trim();
  const adminPassword = String(formData.get("admin_password") ?? "");

  if (!nom || !adminNom || !adminEmail || !adminPassword) {
    return { error: "Tous les champs sont requis." };
  }

  const slug = slugify(slugInput || nom);
  if (!slug) return { error: "Identifiant invalide." };

  const admin = createAdminClient();

  // Point d'entree public sans authentification : cree un vrai tenant + un
  // vrai compte auth.users + un email a tous les super_admins a CHAQUE appel
  // (voir plus bas) -- limite obligatoire par IP ET par email avant toute
  // ecriture, sinon abusable pour epuiser le quota Auth Supabase ou spammer
  // les boites mail des super_admins.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const okIp = await checkRateLimit(admin, `signup-etablissement:ip:${ip}`, { max: 3, fenetreMinutes: 60 });
  const okEmail = await checkRateLimit(admin, `signup-etablissement:email:${adminEmail.toLowerCase()}`, {
    max: 3,
    fenetreMinutes: 60,
  });
  if (!okIp || !okEmail) {
    return { error: "Trop de tentatives, réessayez plus tard." };
  }

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ nom, slug, statut: "en_attente" })
    .select("id")
    .single();

  if (tenantError) {
    if (tenantError.code === "23505") {
      return { error: "Cet identifiant est déjà pris, essayez-en un autre." };
    }
    return { error: "Impossible de créer l'établissement." };
  }

  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });

  if (createUserError || !created.user) {
    await admin.from("tenants").delete().eq("id", tenant.id);
    return { error: createUserError?.message ?? "Impossible de créer le compte administrateur." };
  }

  // Compte banni jusqu'à approbation par un super_admin — un vrai blocage au
  // niveau Supabase Auth (pas seulement un gate cote UI/RLS), meme mecanisme
  // que la desactivation de compte existante (toggleAccountActive).
  await admin.auth.admin.updateUserById(created.user.id, { ban_duration: "876000h" });

  const { error: insertError } = await admin.from("users").insert({
    id: created.user.id,
    tenant_id: tenant.id,
    role: "admin_tenant",
    nom: adminNom,
    email: adminEmail,
  });

  if (insertError) return { error: insertError.message };

  await logAudit(admin, {
    acteurId: created.user.id,
    tenantId: tenant.id,
    action: "etablissement_demande_inscription",
    cibleType: "tenant",
    cibleId: tenant.id,
    details: { nom, slug, admin_email: adminEmail },
  });

  const { data: superAdmins } = await admin.from("users").select("email").eq("role", "super_admin");
  for (const sa of superAdmins ?? []) {
    if (sa.email) {
      await sendEmail({
        to: sa.email,
        subject: `Nouvelle demande d'établissement — ${nom}`,
        html: `<p><strong>${nom}</strong> (${adminNom}, ${adminEmail}) souhaite rejoindre AtlasLab.</p><p>Approuvez ou refusez depuis la page <a href="https://atlaslabedu.com/admin/etablissements">Établissements</a>.</p>`,
      });
    }
  }

  return { success: true };
}
