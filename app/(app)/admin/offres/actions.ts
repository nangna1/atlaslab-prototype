"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { normalizeForSearch } from "@/lib/search";

async function requireStaff() {
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

  if (
    !callerProfile ||
    !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role) ||
    !callerProfile.tenant_id
  ) {
    return { supabase, caller, tenantId: null, error: "Action réservée au staff." } as const;
  }

  return { supabase, caller, tenantId: callerProfile.tenant_id as string, error: null } as const;
}

export type CreateOffreState = { error?: string; success?: boolean };

export async function createOffre(
  _prevState: CreateOffreState,
  formData: FormData,
): Promise<CreateOffreState> {
  const { supabase, caller, tenantId, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const titre = String(formData.get("titre") ?? "").trim();
  const entreprise = String(formData.get("entreprise") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const filiere = String(formData.get("filiere") ?? "").trim();
  const localisation = String(formData.get("localisation") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();

  if (!titre || !entreprise || !["stage", "emploi"].includes(type)) {
    return { error: "Titre, entreprise et type sont requis." };
  }

  const { error } = await supabase.from("offres_emploi").insert({
    tenant_id: tenantId,
    titre,
    entreprise,
    type,
    filiere: filiere || null,
    localisation: localisation || null,
    description: description || null,
    contact: contact || null,
    publiee_par: caller!.id,
  });

  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "offre_publiee",
    cibleType: "offre_emploi",
    details: { titre, entreprise, type },
  });

  await notifyMatchingEleves({ supabase, tenantId, titre, entreprise, type, filiere });

  revalidatePath("/admin/offres");
  revalidatePath("/offres");
  return { success: true };
}

// Alerte les eleves de la filiere concernee (ou tous les eleves du tenant si
// aucune filiere n'est precisee) qu'une nouvelle offre vient d'etre publiee —
// in-app, email et WhatsApp (best-effort, une erreur d'envoi n'annule jamais
// la publication de l'offre elle-meme).
async function notifyMatchingEleves({
  supabase,
  tenantId,
  titre,
  entreprise,
  type,
  filiere,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  titre: string;
  entreprise: string;
  type: string;
  filiere: string;
}) {
  let targetIds: string[];

  if (filiere) {
    const { data: coursesTenant } = await supabase.from("courses").select("id, filiere").eq("tenant_id", tenantId);
    const matchCourseIds = (coursesTenant ?? [])
      .filter((c) => c.filiere && normalizeForSearch(c.filiere) === normalizeForSearch(filiere))
      .map((c) => c.id);
    if (matchCourseIds.length === 0) return;
    const { data: enrolled } = await supabase.from("enrollments").select("user_id").in("course_id", matchCourseIds);
    targetIds = [...new Set((enrolled ?? []).map((e) => e.user_id))];
  } else {
    const { data: allEleves } = await supabase.from("users").select("id").eq("tenant_id", tenantId).eq("role", "apprenant");
    targetIds = (allEleves ?? []).map((u) => u.id);
  }

  if (targetIds.length === 0) return;

  const typeLabel = type === "stage" ? "stage" : "emploi";

  await supabase.from("notifications").insert(
    targetIds.map((id) => ({
      user_id: id,
      type: "nouvelle_offre",
      titre: "Nouvelle offre publiée",
      message: `${entreprise} recrute : « ${titre} » (${typeLabel}).`,
      lien: "/offres",
    })),
  );

  const { data: eleves } = await supabase.from("users").select("email, telephone").in("id", targetIds);
  for (const e of eleves ?? []) {
    if (e.email) {
      await sendEmail({
        to: e.email,
        subject: `Nouvelle offre — ${titre}`,
        html: `<p><strong>${entreprise}</strong> propose : <strong>${titre}</strong> (${typeLabel}).</p><p>Consultez-la sur la <a href="https://atlaslabedu.com/offres">bourse aux stages/emplois</a>.</p>`,
      });
    }
    if (e.telephone) {
      // "_v2" : voir le commentaire equivalent dans
      // app/admin/decrochage/actions.ts (meme incident de suppression cote
      // Meta Business Manager, meme republication en categorie Utilitaire).
      await sendWhatsAppTemplate({
        to: e.telephone,
        templateName: "atlaslab_nouvelle_offre_v2",
        bodyParams: [entreprise, titre],
      });
    }
  }
}

export type ToggleOffreState = { error?: string };

export async function toggleOffreStatut(
  _prevState: ToggleOffreState,
  formData: FormData,
): Promise<ToggleOffreState> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const targetId = String(formData.get("target_id") ?? "");
  const currentStatut = String(formData.get("statut") ?? "");
  if (!targetId) return { error: "Offre invalide." };

  const { error } = await supabase
    .from("offres_emploi")
    .update({ statut: currentStatut === "ouverte" ? "fermee" : "ouverte" })
    .eq("id", targetId);
  if (error) return { error: error.message };

  revalidatePath("/admin/offres");
  revalidatePath("/offres");
  return {};
}

export async function deleteOffre(formData: FormData): Promise<void> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return;

  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) return;

  await supabase.from("offres_emploi").delete().eq("id", targetId);

  revalidatePath("/admin/offres");
  revalidatePath("/offres");
}
